import { useMemo } from "react";
import type { GoalEntity } from "../../../schemas";
import { useConfigStore } from "../../../store/config";
import { useEntityStore } from "../../../store/entities";
import { useUIStore } from "../../../store/ui";
import { getAreaColor } from "../../../services/categories";
import { fmtShortDate } from "../../../services/format";
import { ENTITY_ICONS } from "../../../services/entity-icons";
import { StatFooter } from "./widgets/StatFooter";
import { Sparkline } from "./widgets/Sparkline";

// Parses strings like "33K", "55,000", "12.3K" to a numeric value.
// Returns null when the string isn't a recognisable number.
function parseNumeric(s: string): number | null {
  const m = /^([\d.,]+)\s*([KkMmBb])?$/.exec(s.trim());
  if (!m) return null;
  const base = parseFloat(m[1].replace(/,/g, ""));
  if (!Number.isFinite(base)) return null;
  const suffix = m[2]?.toLowerCase();
  const mult =
    suffix === "k" ? 1000 : suffix === "m" ? 1_000_000 : suffix === "b" ? 1_000_000_000 : 1;
  return base * mult;
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
  if (rem >= 1000) return `осталось ${Math.round(rem / 100) / 10}K`;
  return `осталось ${Math.round(rem)}`;
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
        (e) => e.type === "metric" && f.linked_metric_ids.includes(e.id),
      ),
    [entities, f.linked_metric_ids],
  );

  // First linked metric with enough history drives the sparkline.
  const sparkMetric = linkedMetrics.find(
    (m) => m.type === "metric" && m.fields.history.length >= 2,
  );
  const sparkData =
    sparkMetric && sparkMetric.type === "metric"
      ? sparkMetric.fields.history
          .slice()
          .sort((a, b) => (a.date < b.date ? -1 : 1))
          .map((h) => h.value)
      : null;

  const firstTag = entity.tags[0] ?? "work";
  const lineColor = getAreaColor(firstTag, areas);

  return (
    <>
      <section className="edp-sec">
        <div className="goal-block">
          <div className="goal-nums">
            <span className="goal-cur">{f.current_value}</span>
            <span className="goal-target">/ {f.target}</span>
          </div>
          <div className="edp-pbar" style={{ height: 8 }}>
            <div
              className="edp-pfill"
              style={{
                width: `${progress ?? 0}%`,
                background: "var(--accent)",
              }}
            />
          </div>
          <div className="goal-sub">
            {progress != null && <>{progress}% </>}
            {remain && <span>{remain}</span>}
            {f.target_date && (
              <span>дедлайн {fmtShortDate(f.target_date)}</span>
            )}
          </div>
        </div>
      </section>

      <StatFooter
        items={[
          {
            label: "Текущее",
            value: f.current_value,
          },
          {
            label: "Цель",
            value: f.target,
          },
          {
            label: "Дедлайн",
            value: f.target_date ? fmtShortDate(f.target_date) : "—",
          },
        ]}
      />

      {linkedMetrics.length > 0 && (
        <section className="edp-sec">
          <div className="edp-sec-title">Связанные метрики</div>
          {linkedMetrics.map(
            (m) =>
              m.type === "metric" && (
                <div
                  key={m.id}
                  className="ct-link-item"
                  onClick={() => setSelected(m.id)}
                  role="button"
                  tabIndex={0}
                >
                  <span style={{ width: 18, display: "inline-block" }}>
                    {ENTITY_ICONS.metric}
                  </span>
                  <span>{m.title}</span>
                  <span
                    style={{
                      marginLeft: "auto",
                      fontFamily: "var(--mono)",
                      color: "var(--text-secondary)",
                    }}
                  >
                    {m.fields.current_value} {m.fields.unit}
                  </span>
                </div>
              ),
          )}
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
