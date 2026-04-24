import { useEffect, useState } from "react";
import type { RoutineEntity } from "../../../schemas";
import {
  computeRoutineStats,
  type RoutineStats,
} from "../../../services/routine-stats";
import { StreakWeek } from "./widgets/StreakWeek";
import { Heatmap } from "./widgets/Heatmap";

function freqText(entity: RoutineEntity): string {
  const f = entity.fields;
  if (f.frequency === "daily") return "daily";
  if (f.frequency === "weekly") return `${f.days.length}x/week`;
  return f.days.length > 0 ? `${f.days.length}д/нед` : "custom";
}

function todayIndex(): number {
  const day = new Date().getDay(); // 0=Sun..6=Sat
  // Mon..Sun → 0..6
  return day === 0 ? 6 : day - 1;
}

export function RoutineDetail({ entity }: { entity: RoutineEntity }) {
  const [stats, setStats] = useState<RoutineStats | null>(null);

  useEffect(() => {
    let cancelled = false;
    setStats(null);
    computeRoutineStats(entity.id).then((s) => {
      if (!cancelled) setStats(s);
    });
    return () => {
      cancelled = true;
    };
  }, [entity.id]);

  if (!stats) {
    return (
      <section className="edp-sec">
        <div className="edp-sec-title">Текущая серия</div>
        <div className="edp-desc" style={{ color: "var(--text-tertiary)" }}>
          Загрузка статистики…
        </div>
      </section>
    );
  }

  return (
    <>
      <section className="edp-sec">
        <div className="edp-sec-title">Текущая серия</div>
        <div className="stat-row">
          <div className="stat-card">
            <div className="stat-num" style={{ color: "var(--success)" }}>
              {stats.streak}
            </div>
            <div className="stat-label">Дней подряд</div>
          </div>
          <div className="stat-card">
            <div className="stat-num">{stats.rate}%</div>
            <div className="stat-label">Выполнение</div>
          </div>
          <div className="stat-card">
            <div className="stat-num" style={{ fontSize: "var(--fs-md)" }}>
              {freqText(entity)}
            </div>
            <div className="stat-label">Частота</div>
          </div>
        </div>
        <StreakWeek weekDone={stats.weekDone} today={todayIndex()} />
      </section>
      <section className="edp-sec">
        <div className="edp-sec-title">Активность (6 месяцев)</div>
        <Heatmap weeks={stats.heatmap} />
      </section>
    </>
  );
}
