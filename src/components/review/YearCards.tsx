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
import {
  cadencePctForDirections,
  hoursByCategory,
  orderedAreas,
} from "../../services/review-aggregations";
import { getWeekStartDate, isWithin } from "../../services/time-utils";
import { useConfigStore } from "../../store/config";
import { useEntityStore } from "../../store/entities";
import { Gauge } from "./Gauge";

const EMPTY_AREAS: never[] = [];
const MONTHS_RU = [
  "Янв","Фев","Мар","Апр","Май","Июн",
  "Июл","Авг","Сен","Окт","Ноя","Дек",
];

interface Props {
  data: ReviewData;
}

export function YearCards({ data }: Props) {
  const entities = useEntityStore((s) => s.entities);
  const config = useConfigStore((s) => s.config);
  const rawAreas = config?.areas ?? EMPTY_AREAS;
  const areas = useMemo(() => orderedAreas(rawAreas), [rawAreas]);

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

  // 52 weeks newest-first → reverse for left-to-right oldest →
  // newest display.
  const weeks = useMemo(() => [...data.weeks].reverse(), [data.weeks]);

  const allBlocks: Block[] = useMemo(
    () => weeks.flatMap((w) => w.bundle?.blocks ?? []),
    [weeks],
  );

  const totalBlocks = allBlocks.length;
  const totalDone = allBlocks.filter((b) => b.status === "done").length;
  const totalMinutes = allBlocks.reduce((s, b) => s + b.duration, 0);
  const totalHours = totalMinutes / 60;
  const weeksWithData = Math.max(
    1,
    weeks.filter((w) => (w.bundle?.blocks.length ?? 0) > 0).length,
  );
  const avgExec = totalBlocks
    ? Math.round((totalDone / totalBlocks) * 100)
    : 0;
  const cadPct = cadencePctForDirections(directions, today);

  // Year window for project counts: oldest loaded week's Monday.
  const oldestId = weeks[0]?.id;
  const yearStartIso = oldestId ? getWeekStartDate(oldestId) : null;
  const projectsDone = yearStartIso
    ? projects.filter(
        (p) =>
          p.status === "done" &&
          isWithin(p.updated_at, yearStartIso, today),
      ).length
    : 0;
  const projectsActive = projects.filter(
    (p) => p.status === "active",
  ).length;
  const currentYear = today.getFullYear();

  // Group weeks by calendar month of their Monday. ISO weeks don't
  // line up perfectly with months, but a single Monday lands in
  // exactly one month — close enough for a 12-bar trend. (Known
  // imprecision: 2025-w01's Monday is 2024-12-30, so a year-boundary
  // window can produce 13 buckets; documented for Phase 9.)
  const monthlyExec = useMemo(() => {
    const byMonth: Record<number, { done: number; total: number }> = {};
    for (const w of weeks) {
      const start = getWeekStartDate(w.id);
      const [y, m] = start.split("-").map(Number);
      // Encode (year, month) into a single key so 2025-12 stays
      // distinct from 2026-12 — matters for week 1/52 spillover.
      const key = y * 12 + (m - 1);
      const blocks = w.bundle?.blocks ?? [];
      const done = blocks.filter((b) => b.status === "done").length;
      const cur = byMonth[key] ?? { done: 0, total: 0 };
      cur.done += done;
      cur.total += blocks.length;
      byMonth[key] = cur;
    }
    const keys = Object.keys(byMonth).map(Number).sort((a, b) => a - b);
    return keys.map((key) => {
      const month = key % 12;
      const year = Math.floor(key / 12);
      const { done, total } = byMonth[key];
      return {
        label: MONTHS_RU[month],
        year,
        exec: total ? Math.round((done / total) * 100) : 0,
      };
    });
  }, [weeks]);

  const yearCatHours = useMemo(
    () => hoursByCategory(allBlocks),
    [allBlocks],
  );
  const maxCatHours = Math.max(1, ...Object.values(yearCatHours));

  const measurableDirs = useMemo(
    () => directions.filter((d) => d.fields.progress != null),
    [directions],
  );

  const hasAnyData = totalBlocks > 0;
  const isLoading = data.status === "loading";

  return (
    <>
      {/* Card 1 — 4 gauges. Always rendered; current week is live, so
          numbers are at least non-empty even while historical loads. */}
      <div className="rv-card full">
        <div className="rv-gauge-row">
          <Gauge
            value={avgExec}
            color={gaugeColor(avgExec, "exec")}
            title="Среднее выполнение"
            subtitle={
              hasAnyData
                ? `${totalDone}/${totalBlocks} блоков · ${weeksWithData} нед.`
                : "нет блоков"
            }
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
            fontSize={11}
            title="Продуктивных часов"
            subtitle={`~${(totalHours / weeksWithData).toFixed(0)}ч/нед`}
          />
          <Gauge
            value={projectsDone}
            ring={false}
            fontSize={14}
            color="var(--accent)"
            title="Проектов завершено"
            subtitle={`из ${projectsActive} в работе`}
          />
        </div>
      </div>

      {/* Card 2 — Monthly trend */}
      <div className="rv-card span2">
        <h4>Выполнение по месяцам</h4>
        {isLoading && !hasAnyData ? (
          <div className="rv-empty">Загружаем последние 52 недели…</div>
        ) : !hasAnyData ? (
          <div className="rv-empty">Недостаточно данных для отчёта</div>
        ) : (
          <div className="rv-chart" style={{ height: 130 }}>
            {monthlyExec.map((m, i) => {
              const barPx = Math.max(2, (m.exec / 100) * 114);
              return (
                <div
                  className="rv-chart-col"
                  key={`${m.year}-${m.label}-${i}`}
                >
                  <div className="rv-chart-bar">
                    <div
                      style={{
                        height: barPx,
                        background: gaugeColor(m.exec, "exec"),
                        borderRadius: 3,
                      }}
                    />
                  </div>
                  <span className="rv-chart-label">{m.label}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Card 3 — Categories yearly */}
      <div className="rv-card">
        <h4>Часов за {currentYear}</h4>
        {!hasAnyData ? (
          <div className="rv-empty">нет данных</div>
        ) : (
          areas.map((a) => {
            const hrs = yearCatHours[a.id] ?? 0;
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
                <span className="rv-cat-val">{hrs.toFixed(0)}ч</span>
              </div>
            );
          })
        )}
      </div>

      {/* Card 4 — Итоги года: directions progress + achievements
          placeholder. Achievements need an algorithm to derive (mock
          hardcodes them) — Phase 9 ships real list, for now we keep
          the right column structurally so the layout matches the
          mock. */}
      <div className="rv-card full">
        <h4>Итоги года</h4>
        <div className="rv-grid-2">
          <div>
            <h4 style={{ marginTop: 0 }}>
              Направления — прогресс за год
            </h4>
            {measurableDirs.length === 0 ? (
              <div className="rv-empty">нет измеримых направлений</div>
            ) : (
              measurableDirs.map((d) => {
                const tag = d.tags[0];
                const dotColor = tag
                  ? getAreaColor(tag, areas)
                  : "var(--accent)";
                const progress = d.fields.progress ?? 0;
                return (
                  <div key={d.id}>
                    <div className="rv-stat">
                      <span
                        className="rv-label"
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 6,
                        }}
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
                      <span className="rv-val">
                        {d.fields.current ?? "—"}
                        {d.fields.target ? ` → ${d.fields.target}` : ""}
                      </span>
                    </div>
                    <div
                      className="rv-bar-wrap"
                      style={{ margin: "-2px 0 4px" }}
                    >
                      <div className="rv-bar">
                        <span
                          style={{
                            width: `${progress}%`,
                            background: dotColor,
                          }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
          <div>
            <h4 style={{ marginTop: 0 }}>Достижения</h4>
            <div className="rv-empty">копится</div>
          </div>
        </div>
      </div>
    </>
  );
}
