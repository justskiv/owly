import { useMemo } from "react";
import type { ReviewData } from "../../hooks/useReviewData";
import { useToday } from "../../hooks/useToday";
import type {
  Block,
  DirectionEntity,
  ProjectEntity,
} from "../../schemas";
import { getAreaColor } from "../../services/categories";
import { gaugeColor } from "../../services/gauge-math";
import type { PoolItemView } from "../../services/recalc-pool";
import {
  cadencePctForDirections,
  execPctForBlocks,
  hasCadence,
  hoursByCategory,
  orderedAreas,
  poolPctForItems,
} from "../../services/review-aggregations";
import { dateForDayIndex } from "../../services/time-utils";
import { cadUrgClass, daysSince } from "../../services/urgency";
import { useConfigStore } from "../../store/config";
import { useEntityStore } from "../../store/entities";
import { useScheduleStore } from "../../store/schedule";
import { Gauge } from "./Gauge";

const EMPTY_AREAS: never[] = [];
const DOW_RU = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];
const STALE_DAYS = 14;
const STALE_LIMIT = 10;
// Spec §9.4: per-day chart heights are normalized against a 16h
// per-day cap so a single very-busy day doesn't squash the others
// and so the chart looks consistent across weeks.
const DAY_CAP_HOURS = 16;

interface Props {
  data: ReviewData;
}

export function WeekCards({ data }: Props) {
  const entities = useEntityStore((s) => s.entities);
  const config = useConfigStore((s) => s.config);
  const rawAreas = config?.areas ?? EMPTY_AREAS;
  const areas = useMemo(() => orderedAreas(rawAreas), [rawAreas]);
  const startDate = useScheduleStore((s) => s.startDate);

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

  const today = useToday();
  const weekDays = useMemo(
    () =>
      Array.from({ length: 7 }, (_, i) => dateForDayIndex(startDate, i)),
    [startDate],
  );

  const entry = data.weeks[0];
  const blocks: Block[] = entry?.bundle?.blocks ?? [];
  const pool: PoolItemView[] = entry?.bundle?.pool ?? [];

  const exec = execPctForBlocks(blocks);
  const poolPct = poolPctForItems(pool);
  const cadPct = cadencePctForDirections(directions, today);

  const cadDirs = useMemo(() => directions.filter(hasCadence), [directions]);

  const measurableDirs = useMemo(
    () => directions.filter((d) => d.fields.progress != null),
    [directions],
  );

  const staleProjects = useMemo(
    () =>
      projects
        .filter(
          (p) =>
            p.status === "active" &&
            (p.fields.last_activity_days ?? 0) >= STALE_DAYS,
        )
        .sort(
          (a, b) =>
            (b.fields.last_activity_days ?? 0) -
            (a.fields.last_activity_days ?? 0),
        )
        .slice(0, STALE_LIMIT),
    [projects],
  );

  const catHours = useMemo(() => hoursByCategory(blocks), [blocks]);
  const maxCatHours = Math.max(1, ...Object.values(catHours));

  // Card 1 subtitle stats — match the mock copy.
  const doneBlocks = blocks.filter((b) => b.status === "done").length;
  const doneHours = blocks
    .filter((b) => b.status === "done")
    .reduce((s, b) => s + b.duration, 0) / 60;
  const totalHours = blocks.reduce((s, b) => s + b.duration, 0) / 60;
  const poolDone = pool.filter((pi) =>
    pi.splittable ? pi.scheduled >= pi.hours : pi.placed,
  ).length;
  const cadOk = cadDirs.filter((d) => {
    const since = daysSince(d.fields.last_act, today);
    return since !== null && since <= d.fields.cadence;
  }).length;

  return (
    <>
      {/* Card 1 — 3 gauges */}
      <div className="rv-card full">
        <div className="rv-gauge-row">
          <Gauge
            value={exec}
            color={gaugeColor(exec, "exec")}
            title="Выполнение блоков"
            subtitle={
              blocks.length === 0
                ? "нет блоков"
                : `${doneBlocks}/${blocks.length} блоков · ${doneHours.toFixed(1)}/${totalHours.toFixed(1)}ч`
            }
          />
          <Gauge
            value={poolPct}
            color={gaugeColor(poolPct, "pool")}
            title="Пул недели"
            subtitle={
              pool.length === 0
                ? "пусто"
                : `${poolDone}/${pool.length} задач завершено`
            }
          />
          <Gauge
            value={cadPct}
            color={gaugeColor(cadPct, "cadence")}
            title="Каденции"
            subtitle={
              cadDirs.length === 0
                ? "нет каденций"
                : `${cadOk}/${cadDirs.length} в норме`
            }
          />
        </div>
      </div>

      {/* Card 2 — Pool недели */}
      <div className="rv-card">
        <h4>Пул недели</h4>
        {pool.length === 0 ? (
          <div className="rv-empty">нет данных</div>
        ) : (
          pool.map((pi) => (
            <div className="rv-stat" key={pi.id}>
              <span className="rv-label">{pi.title}</span>
              <span
                className="rv-val"
                style={{ color: poolItemColor(pi) }}
              >
                {poolItemValue(pi)}
              </span>
            </div>
          ))
        )}
      </div>

      {/* Card 3 — Каденции */}
      <div className="rv-card">
        <h4>Каденции</h4>
        {cadDirs.length === 0 ? (
          <div className="rv-empty">нет каденций</div>
        ) : (
          cadDirs.map((d) => {
            const cadence = d.fields.cadence;
            const since = daysSince(d.fields.last_act, today) ?? 0;
            const over = since - cadence;
            const dotColor = directionDotColor(d, areas);
            return (
              <div className="rv-stat" key={d.id}>
                <span
                  className="rv-label"
                  style={{ display: "flex", alignItems: "center", gap: 6 }}
                >
                  <span
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: "50%",
                      background: dotColor,
                      flexShrink: 0,
                    }}
                  />
                  {d.title}
                </span>
                <span className={"rv-val " + cadUrgClass(over)}>
                  {since}д/{cadence}д {over <= 0 ? "✓" : "⚠"}
                </span>
              </div>
            );
          })
        )}
      </div>

      {/* Card 4 — Время по категориям */}
      <div className="rv-card">
        <h4>Время по категориям</h4>
        {areas.length === 0 ? (
          <div className="rv-empty">нет категорий</div>
        ) : (
          areas.map((a) => {
            const hrs = catHours[a.id] ?? 0;
            return (
              <div className="rv-cat-bar" key={a.id}>
                <span className="rv-cat-label">{a.label}</span>
                <div className="rv-cat-fill">
                  <span
                    style={{
                      width: `${(hrs / maxCatHours) * 100}%`,
                      background: a.color,
                    }}
                  />
                </div>
                <span className="rv-cat-val">{hrs.toFixed(1)}ч</span>
              </div>
            );
          })
        )}

        <h4 style={{ marginTop: 12 }}>По дням</h4>
        <div className="rv-chart">
          {weekDays.map((day, i) => {
            // Total counts only blocks whose category is in the
            // configured areas list; otherwise an unmapped category
            // would inflate the bar height but render no segment,
            // leaving a visible gap. Block durations are in minutes.
            const knownIds = new Set(areas.map((a) => a.id));
            const dayKnown = blocks.filter(
              (b) => b.date === day && knownIds.has(b.category),
            );
            const total = dayKnown.reduce((s, b) => s + b.duration, 0) / 60;
            const barPx =
              total === 0
                ? 0
                : Math.max(2, Math.min(84, (total / DAY_CAP_HOURS) * 84));
            return (
              <div className="rv-chart-col" key={day}>
                <div className="rv-chart-bar" style={{ height: barPx }}>
                  {areas.map((a) => {
                    const aHrs = dayKnown
                      .filter((b) => b.category === a.id)
                      .reduce((s, b) => s + b.duration, 0) / 60;
                    if (aHrs === 0 || total === 0) return null;
                    const segPx = (aHrs / total) * barPx;
                    return (
                      <div
                        key={a.id}
                        style={{
                          height: segPx,
                          background: a.color,
                        }}
                      />
                    );
                  })}
                </div>
                <span className="rv-chart-label">{DOW_RU[i]}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Card 5 — Направления */}
      <div className="rv-card full">
        <h4>Направления</h4>
        <div className="rv-grid-2">
          <div>
            <h4 style={{ marginTop: 0 }}>Прогресс измеримых</h4>
            {measurableDirs.length === 0 ? (
              <div className="rv-empty">нет измеримых направлений</div>
            ) : (
              measurableDirs.map((d) => {
                const dotColor = directionDotColor(d, areas);
                const progress = d.fields.progress ?? 0;
                return (
                  <div key={d.id}>
                    <div className="rv-stat">
                      <span
                        className="rv-label"
                        style={{ display: "flex", alignItems: "center", gap: 6 }}
                      >
                        <span
                          style={{
                            width: 8, height: 8, borderRadius: "50%",
                            background: dotColor, flexShrink: 0,
                          }}
                        />
                        {d.title}
                      </span>
                      <span className="rv-val">
                        {d.fields.current ?? "—"}
                        {d.fields.target ? ` → ${d.fields.target}` : ""}
                      </span>
                    </div>
                    <div className="rv-bar-wrap" style={{ margin: "-2px 0 6px" }}>
                      <div className="rv-bar">
                        <span style={{ width: `${progress}%`, background: dotColor }} />
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
          <div>
            <h4 style={{ marginTop: 0 }}>
              Заброшенные проекты (≥{STALE_DAYS}д)
            </h4>
            {staleProjects.length === 0 ? (
              <div className="rv-empty">все проекты свежие</div>
            ) : (
              staleProjects.map((p) => (
                <div className="rv-stat" key={p.id}>
                  <span className="rv-label">{p.title}</span>
                  <span className="rv-val" style={{ color: "var(--error)" }}>
                    {p.fields.last_activity_days ?? 0}д
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </>
  );
}

function poolItemValue(pi: PoolItemView): string {
  if (pi.splittable) {
    return `${pi.scheduled.toFixed(1)}/${pi.hours}ч`;
  }
  return pi.placed ? "✓" : "—";
}

function poolItemColor(pi: PoolItemView): string {
  if (pi.splittable) {
    const pct = pi.hours > 0 ? pi.scheduled / pi.hours : 0;
    if (pct >= 1) return "var(--success)";
    if (pct >= 0.5) return "var(--warning)";
    return "var(--text-tertiary)";
  }
  return pi.placed ? "var(--success)" : "var(--text-disabled)";
}

function directionDotColor(
  d: DirectionEntity,
  areas: readonly { id: string; color: string }[],
): string {
  const tag = d.tags[0];
  if (!tag) return "var(--text-tertiary)";
  return getAreaColor(tag, areas);
}
