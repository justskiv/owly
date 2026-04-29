import { useMemo, type KeyboardEvent } from "react";
import type { GoalEntity, MetricEntity } from "../../../schemas";
import { useConfigStore } from "../../../store/config";
import { useEntityStore } from "../../../store/entities";
import { useUIStore } from "../../../store/ui";
import { getAreaColor } from "../../../services/categories";
import { fmtShortDate } from "../../../services/format";
import { ENTITY_ICONS } from "../../../services/entity-icons";
import { computeMetricStats } from "../../../services/metric-stats";
import { StatFooter } from "./widgets/StatFooter";
import { Sparkline } from "./widgets/Sparkline";

// Pulls the first numeric run from a string like "55K подписчиков
// YouTube" or "33,500". Returns null when nothing parse-able exists.
// Previous version required the whole string to be numeric, so the
// schema's own example target ("55K подписчиков YouTube") rendered as
// 0% progress.
function parseNumeric(s: string): number | null {
  const m = /([\d][\d.,]*)\s*([KkMmBb])?/.exec(s);
  if (!m) return null;
  const base = parseFloat(m[1].replace(/,/g, ""));
  if (!Number.isFinite(base)) return null;
  const suffix = m[2]?.toLowerCase();
  const mult =
    suffix === "k"
      ? 1000
      : suffix === "m"
        ? 1_000_000
        : suffix === "b"
          ? 1_000_000_000
          : 1;
  return base * mult;
}

function fmtCompact(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `${Math.round(n / 100_000) / 10}M`;
  if (abs >= 1000) return `${Math.round(n / 100) / 10}K`;
  return `${Math.round(n * 10) / 10}`;
}

function computeProgress(current: string, target: string): number | null {
  const c = parseNumeric(current);
  const t = parseNumeric(target);
  if (c == null || t == null || t === 0) return null;
  return Math.max(0, Math.min(100, Math.round((c / t) * 100)));
}

function fmtRemain(current: string, target: string): string | null {
  const c = parseNumeric(current);
  const t = parseNumeric(target);
  if (c == null || t == null) return null;
  const rem = Math.max(0, t - c);
  return `осталось ${fmtCompact(rem)}`;
}

function monthsUntil(targetDate: string): number | null {
  const now = new Date();
  const target = new Date(`${targetDate}T00:00:00`);
  const diffMs = target.getTime() - now.getTime();
  if (!Number.isFinite(diffMs) || diffMs <= 0) return null;
  return diffMs / (1000 * 60 * 60 * 24 * 30);
}

// "Темп" and "Прогноз" are derived from the first linked metric with
// enough history. Without a metric there's no time series to project
// from, so we show "—" rather than invent a number.
function computeForecast(
  metric: MetricEntity | undefined,
  targetDate: string | null,
): { pace: string; forecast: string } {
  if (!metric || metric.fields.history.length < 2) {
    return { pace: "—", forecast: "—" };
  }
  const stats = computeMetricStats(metric.fields.history);
  const dates = [...metric.fields.history]
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
    .map((h) => h.date);
  const spanDays = Math.max(
    1,
    (new Date(`${dates[dates.length - 1]}T00:00:00`).getTime() -
      new Date(`${dates[0]}T00:00:00`).getTime()) /
      86_400_000,
  );
  const perMonth = (stats.change / spanDays) * 30;
  const paceSign = perMonth >= 0 ? "+" : "";
  const pace = `${paceSign}${fmtCompact(perMonth)}/мес`;
  if (!targetDate) return { pace, forecast: "—" };
  const months = monthsUntil(targetDate);
  if (months == null) return { pace, forecast: "—" };
  const projected = metric.fields.current_value + perMonth * months;
  return { pace, forecast: `~${fmtCompact(projected)} к дедлайну` };
}

function onActivate(cb: () => void) {
  return (e: KeyboardEvent<HTMLElement>) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      cb();
    }
  };
}

export function GoalDetail({ entity }: { entity: GoalEntity }) {
  const areas = useConfigStore((s) => s.config?.areas) ?? [];
  const entities = useEntityStore((s) => s.entities);
  const setSelected = useUIStore((s) => s.setSelectedEntity);
  const f = entity.fields;

  const progress = computeProgress(f.current_value, f.target);
  const remain = fmtRemain(f.current_value, f.target);

  const linkedMetrics = useMemo(
    () =>
      entities.filter(
        (e): e is MetricEntity =>
          e.type === "metric" && f.linked_metric_ids.includes(e.id),
      ),
    [entities, f.linked_metric_ids],
  );

  // First linked metric with enough history drives the sparkline and
  // the footer's pace/forecast numbers.
  const sparkMetric = linkedMetrics.find((m) => m.fields.history.length >= 2);
  const sparkData = sparkMetric
    ? sparkMetric.fields.history
        .slice()
        .sort((a, b) =>
          a.date < b.date ? -1 : a.date > b.date ? 1 : 0,
        )
        .map((h) => h.value)
    : null;

  const firstTag = entity.tags[0];
  const { pace, forecast } = computeForecast(sparkMetric, f.target_date);
  const lineColor = getAreaColor(firstTag ?? "work", areas);

  const subParts: string[] = [];
  if (progress != null) subParts.push(`${progress}%`);
  if (remain) subParts.push(remain);
  if (f.target_date) subParts.push(`дедлайн ${fmtShortDate(f.target_date)}`);

  const hasNums = f.current_value !== "" || f.target !== "";
  const hasGoalBlock = hasNums || subParts.length > 0;
  const hasForecast = pace !== "—" || forecast !== "—";

  return (
    <>
      {hasGoalBlock && (
        <section className="edp-sec">
          <div className="goal-block">
            {hasNums && (
              <div className="goal-nums">
                <span className="goal-cur">{f.current_value}</span>
                <span className="goal-target">{f.target}</span>
              </div>
            )}
            {progress != null && (
              <div className="edp-pbar" style={{ height: 8 }}>
                <div
                  className="edp-pfill"
                  style={{
                    width: `${progress}%`,
                    background: "var(--accent)",
                  }}
                />
              </div>
            )}
            {subParts.length > 0 && (
              <div className="goal-sub">
                {subParts.map((p, i) => (
                  <span key={i}>{i === 0 ? p : `· ${p}`}</span>
                ))}
              </div>
            )}
          </div>
        </section>
      )}

      {hasForecast && (
        <section className="edp-sec">
          <StatFooter
            items={[
              {
                label: "Темп",
                value: pace,
                color: pace.startsWith("+") ? "success" : undefined,
              },
              { label: "Прогноз", value: forecast },
            ]}
          />
        </section>
      )}

      {linkedMetrics.length > 0 && (
        <section className="edp-sec">
          <div className="edp-sec-title">Связанные метрики</div>
          {linkedMetrics.map((m) => (
            <div
              key={m.id}
              className="ct-link-item"
              onClick={() => setSelected(m.id)}
              onKeyDown={onActivate(() => setSelected(m.id))}
              role="button"
              tabIndex={0}
            >
              <span style={{ width: 18, display: "inline-block" }}>
                {ENTITY_ICONS.metric}
              </span>
              <span className="ct-date-label">{m.title}</span>
              <span className="ct-date-val">
                {m.fields.current_value} {m.fields.unit}
              </span>
            </div>
          ))}
        </section>
      )}

      {sparkData && (
        <section className="edp-sec">
          <div className="edp-sec-title">Динамика</div>
          <Sparkline data={sparkData} color={lineColor} unit="" />
        </section>
      )}
    </>
  );
}
