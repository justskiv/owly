import { useMemo } from "react";
import type { TaskEntity } from "../../schemas";
import { useEntityStore } from "../../store/entities";
import { useConfigStore } from "../../store/config";
import { useUIStore } from "../../store/ui";
import { daysUntil } from "../../services/urgency";

const PRIO_ROWS: Array<{
  key: "high" | "medium" | "low";
  icon: string;
  label: string;
}> = [
  { key: "high", icon: "⚡", label: "Высокий" },
  { key: "medium", icon: "●", label: "Средний" },
  { key: "low", icon: "○", label: "Низкий" },
];

const EMPTY_AREAS: never[] = [];

export function TasksSidebar() {
  const entities = useEntityStore((s) => s.entities);
  const areas = useConfigStore((s) => s.config?.areas ?? EMPTY_AREAS);
  const filter = useUIStore((s) => s.taskFilter);
  const setStatus = useUIStore((s) => s.setTaskFilterStatus);
  const setCat = useUIStore((s) => s.setTaskFilterCat);
  const setPrio = useUIStore((s) => s.setTaskFilterPrio);
  const clearAll = useUIStore((s) => s.clearTaskFilters);

  const counts = useMemo(() => {
    const allTasks = entities.filter(
      (e): e is TaskEntity => e.type === "task",
    );
    const active = allTasks.filter((t) => t.status !== "done");
    const done = allTasks.filter((t) => t.status === "done");
    let overdue = 0;
    let week = 0;
    for (const t of active) {
      const d = daysUntil(t.deadline);
      if (d === null) continue;
      if (d < 0) overdue++;
      else if (d <= 7) week++;
    }
    const byCat = new Map<string, number>();
    const knownIds = new Set(areas.map((a) => a.id));
    for (const t of active) {
      for (const tag of t.tags) {
        if (knownIds.has(tag)) {
          byCat.set(tag, (byCat.get(tag) ?? 0) + 1);
          break;
        }
      }
    }
    const byPrio: Record<"high" | "medium" | "low", number> = {
      high: 0,
      medium: 0,
      low: 0,
    };
    for (const t of active) {
      if (t.priority) byPrio[t.priority]++;
    }
    return {
      active: active.length,
      done: done.length,
      overdue,
      week,
      byCat,
      byPrio,
    };
  }, [entities, areas]);

  const isAll =
    filter.status === null && filter.cat === null && filter.prio === null;

  return (
    <aside className="tasks-side">
      <div className="ts-card">
        <h4>Статус</h4>
        <button
          type="button"
          className={`ts-row${isAll ? " active" : ""}`}
          onClick={clearAll}
        >
          <span>Все</span>
          <span className="ts-row-count">{counts.active}</span>
        </button>
        <button
          type="button"
          className={`ts-row${filter.status === "done" ? " active" : ""}`}
          onClick={() =>
            setStatus(filter.status === "done" ? null : "done")
          }
        >
          <span>Выполнено</span>
          <span className="ts-row-count urgency-ok">{counts.done}</span>
        </button>
        {counts.overdue > 0 && (
          <button
            type="button"
            className={`ts-row${filter.status === "overdue" ? " active" : ""}`}
            onClick={() =>
              setStatus(filter.status === "overdue" ? null : "overdue")
            }
          >
            <span>Просрочено</span>
            <span className="ts-row-count urgency-bad">{counts.overdue}</span>
          </button>
        )}
        {counts.week > 0 && (
          <button
            type="button"
            className={`ts-row${filter.status === "week" ? " active" : ""}`}
            onClick={() =>
              setStatus(filter.status === "week" ? null : "week")
            }
          >
            <span>На неделе</span>
            <span className="ts-row-count urgency-warn">{counts.week}</span>
          </button>
        )}
      </div>

      <div className="ts-card">
        <h4>Категория</h4>
        {areas.map((a) => (
          <button
            key={a.id}
            type="button"
            className={`ts-row${filter.cat === a.id ? " active" : ""}`}
            onClick={() => setCat(filter.cat === a.id ? null : a.id)}
          >
            <span
              className="ts-row-dot"
              style={{ background: a.color }}
              aria-hidden
            />
            <span>{a.label}</span>
            <span className="ts-row-count">
              {counts.byCat.get(a.id) ?? 0}
            </span>
          </button>
        ))}
      </div>

      <div className="ts-card">
        <h4>Приоритет</h4>
        {PRIO_ROWS.map((p) => (
          <button
            key={p.key}
            type="button"
            className={`ts-row${filter.prio === p.key ? " active" : ""}`}
            onClick={() => setPrio(filter.prio === p.key ? null : p.key)}
          >
            <span aria-hidden>{p.icon}</span>
            <span>{p.label}</span>
            <span className="ts-row-count">{counts.byPrio[p.key]}</span>
          </button>
        ))}
      </div>
    </aside>
  );
}
