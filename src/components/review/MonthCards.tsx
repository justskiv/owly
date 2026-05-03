import { useMemo } from "react";
import type { ReviewData } from "../../hooks/useReviewData";
import type {
  Block,
  DirectionEntity,
  ProjectEntity,
} from "../../schemas";
import { gaugeColor } from "../../services/gauge-math";
import {
  cadencePctForDirections,
  execPctForBlocks,
  hoursByCategory,
} from "../../services/review-aggregations";
import { getWeekStartDate } from "../../services/time-utils";
import { daysSince } from "../../services/urgency";
import { useConfigStore } from "../../store/config";
import { useEntityStore } from "../../store/entities";
import { Gauge } from "./Gauge";

const EMPTY_AREAS: never[] = [];

interface Props {
  data: ReviewData;
}

// Spec §9.5: month aggregates the last 4 weeks. We chart them oldest
// → newest so the rightmost bar is the current week (matches mock
// orientation, easier to read week-over-week change).
export function MonthCards({ data }: Props) {
  const entities = useEntityStore((s) => s.entities);
  const config = useConfigStore((s) => s.config);
  const areas = config?.areas ?? EMPTY_AREAS;
  const directions = useMemo<DirectionEntity[]>(
    () =>
      entities.filter(
        (e): e is DirectionEntity => e.type === "direction",
      ),
    [entities],
  );
  const projects = useMemo<ProjectEntity[]>(
    () =>
      entities.filter((e): e is ProjectEntity => e.type === "project"),
    [entities],
  );

  const today = useMemo(() => new Date(), []);

  // weeks come newest-first from the hook (offsets 0, -1, -2, -3);
  // reverse for display so the trend reads left-to-right oldest →
  // newest.
  const weeks = useMemo(() => [...data.weeks].reverse(), [data.weeks]);

  const allBlocks: Block[] = useMemo(
    () => weeks.flatMap((w) => w.bundle?.blocks ?? []),
    [weeks],
  );
  const monthCatHours = useMemo(
    () => hoursByCategory(allBlocks),
    [allBlocks],
  );
  const maxMonthCat = Math.max(1, ...Object.values(monthCatHours));

  const totalBlocks = weeks.reduce(
    (s, w) => s + (w.bundle?.blocks.length ?? 0),
    0,
  );
  const totalDone = weeks.reduce(
    (s, w) =>
      s + (w.bundle?.blocks.filter((b) => b.status === "done").length ?? 0),
    0,
  );
  const totalMinutes = weeks.reduce(
    (s, w) =>
      s + (w.bundle?.blocks.reduce((bs, b) => bs + b.duration, 0) ?? 0),
    0,
  );
  const totalHours = totalMinutes / 60;
  // Weighted avg (total done / total blocks) is more honest than a
  // simple mean of weekly %s — an empty week shouldn't drag the
  // monthly figure to 0.
  const avgExec = totalBlocks
    ? Math.round((totalDone / totalBlocks) * 100)
    : 0;

  const cadPct = cadencePctForDirections(directions, today);

  if (data.status === "loading") {
    return (
      <div className="rv-card full">
        <div className="rv-empty">Загружаем последние 4 недели…</div>
      </div>
    );
  }

  const hasAnyData = totalBlocks > 0;

  // Window for "completed/started this month" = earliest loaded
  // week's Mon → today.
  const oldestId = weeks[0]?.id;
  const monthStartIso = oldestId ? getWeekStartDate(oldestId) : null;

  const completed = monthStartIso
    ? projects.filter(
        (p) =>
          p.status === "done" &&
          isWithin(p.updated_at, monthStartIso, today),
      ).length
    : 0;
  const started = monthStartIso
    ? projects.filter((p) =>
        isWithin(p.created_at, monthStartIso, today),
      ).length
    : 0;
  const active = projects.filter(
    (p) => p.status === "active" && p.fields.last_activity_days < 14,
  ).length;

  const cadDirs = directions.filter(
    (d) => d.fields.cadence != null && d.fields.last_act != null,
  );
  const cadStatus = cadDirs.map((d) => {
    const since = daysSince(d.fields.last_act, today) ?? 0;
    const over = since - (d.fields.cadence as number);
    return { id: d.id, title: d.title, ok: over <= 0 };
  });
  const cadOk = cadStatus.filter((c) => c.ok).length;
  const cadMiss = cadStatus.length - cadOk;

  return (
    <>
      {/* Card 1 — 3 gauges */}
      <div className="rv-card full">
        <div className="rv-gauge-row">
          <Gauge
            value={avgExec}
            color={gaugeColor(avgExec, "exec")}
            title="Среднее выполнение"
            subtitle={`${totalDone}/${totalBlocks} done за 4 недели`}
          />
          <Gauge
            value={cadPct}
            color={gaugeColor(cadPct, "cadence")}
            title="Каденции"
            subtitle="снимок на сегодня"
          />
          <Gauge
            value={`${totalHours.toFixed(0)}ч`}
            ring={false}
            fontSize={12}
            title="Часов запланировано"
            subtitle={`~${(totalHours / 4).toFixed(0)}ч/нед в среднем`}
          />
        </div>
      </div>

      {/* Card 2 — Weekly trend */}
      <div className="rv-card span2">
        <h4>Выполнение по неделям</h4>
        {!hasAnyData ? (
          <div className="rv-empty">Недостаточно данных для отчёта</div>
        ) : (
          <div className="rv-chart" style={{ height: 120 }}>
            {weeks.map((w) => {
              const blocks = w.bundle?.blocks ?? [];
              const exec = execPctForBlocks(blocks);
              const color = gaugeColor(exec, "exec");
              // Explicit pixel height: percentages on bars require a
              // definite parent, which the rv-chart-bar/col flex
              // chain cannot guarantee in WebKit. Pre-compute against
              // the chart's own height (minus the ~16px label area).
              const barPx = Math.max(2, (exec / 100) * 104);
              return (
                <div className="rv-chart-col" key={w.id}>
                  <div className="rv-chart-bar">
                    <div
                      style={{
                        height: barPx,
                        background: color,
                        borderRadius: 3,
                      }}
                    />
                  </div>
                  <span className="rv-chart-label">
                    {weekShortLabel(w.id)}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Card 3 — Categories month totals */}
      <div className="rv-card">
        <h4>Время за месяц</h4>
        {!hasAnyData ? (
          <div className="rv-empty">нет данных</div>
        ) : areas.length === 0 ? (
          <div className="rv-empty">нет категорий</div>
        ) : (
          areas.map((a) => {
            const hrs = monthCatHours[a.id] ?? 0;
            return (
              <div className="rv-cat-bar" key={a.id}>
                <span className="rv-cat-label">{a.label}</span>
                <div className="rv-cat-fill">
                  <span
                    style={{
                      width: `${(hrs / maxMonthCat) * 100}%`,
                      background: a.color,
                    }}
                  />
                </div>
                <span className="rv-cat-val">{hrs.toFixed(0)}ч</span>
              </div>
            );
          })
        )}
      </div>

      {/* Card 4 — Projects / Deltas / Cadences */}
      <div
        className="rv-card full"
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr 1fr",
          gap: 16,
        }}
      >
        <div>
          <h4 style={{ marginTop: 0 }}>Проекты</h4>
          <div className="rv-stat">
            <span className="rv-label">Завершено</span>
            <span className="rv-val" style={{ color: "var(--success)" }}>
              {completed}
            </span>
          </div>
          <div className="rv-stat">
            <span className="rv-label">Начато</span>
            <span className="rv-val">{started}</span>
          </div>
          <div className="rv-stat">
            <span className="rv-label">В работе</span>
            <span className="rv-val">{active}</span>
          </div>
        </div>
        <div>
          <h4 style={{ marginTop: 0 }}>Направления</h4>
          {directions.length === 0 ? (
            <div className="rv-empty">нет данных</div>
          ) : (
            directions.slice(0, 6).map((d) => (
              <div className="rv-stat" key={d.id}>
                <span className="rv-label">{d.title}</span>
                <span
                  className="rv-val"
                  style={{ color: "var(--text-disabled)" }}
                >
                  —
                </span>
              </div>
            ))
          )}
        </div>
        <div>
          <h4 style={{ marginTop: 0 }}>Каденции</h4>
          {cadStatus.length === 0 ? (
            <div className="rv-empty">нет каденций</div>
          ) : (
            <>
              <div className="rv-stat">
                <span className="rv-label">В норме</span>
                <span className="rv-val" style={{ color: "var(--success)" }}>
                  {cadOk}
                </span>
              </div>
              <div className="rv-stat">
                <span className="rv-label">Просрочено</span>
                <span
                  className="rv-val"
                  style={{ color: cadMiss > 0 ? "var(--warning)" : "var(--success)" }}
                >
                  {cadMiss}
                </span>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}

function weekShortLabel(weekId: string): string {
  // "2026-w18" → "w18"
  const parts = weekId.split("-w");
  return `w${parts[1] ?? "?"}`;
}

function isWithin(timestamp: string, fromIso: string, today: Date): boolean {
  const tsDate = new Date(timestamp);
  if (Number.isNaN(tsDate.getTime())) return false;
  const from = new Date(fromIso);
  return tsDate >= from && tsDate <= today;
}
