import { useMemo } from "react";
import type { TaskEntity } from "../../schemas";
import { useEntityStore } from "../../store/entities";
import { useConfigStore } from "../../store/config";
import { useUIStore, type TaskFilter } from "../../store/ui";
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

function eq(a: TaskFilter | null, b: TaskFilter): boolean {
  if (!a) return false;
  if (a.type !== b.type) return false;
  if (a.type === "cat" && b.type === "cat") return a.val === b.val;
  if (a.type === "prio" && b.type === "prio") return a.val === b.val;
  return true;
}

const EMPTY_AREAS: never[] = [];

export function TasksSidebar() {
  const entities = useEntityStore((s) => s.entities);
  const areas = useConfigStore((s) => s.config?.areas ?? EMPTY_AREAS);
  const filter = useUIStore((s) => s.taskFilter);
  const setFilter = useUIStore((s) => s.setTaskFilter);

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

  const toggle = (f: TaskFilter) => {
    setFilter(eq(filter, f) ? null : f);
  };

  const isAll = filter === null;

  return (
    <aside className="tasks-side">
      <div className="ts-card">
        <h4>Обзор</h4>
        <button
          type="button"
          className={`ts-row${isAll ? " active" : ""}`}
          onClick={() => setFilter(null)}
        >
          <span>Все</span>
          <span className="ts-row-count">{counts.active}</span>
        </button>
        <button
          type="button"
          className={`ts-row${eq(filter, { type: "done" }) ? " active" : ""}`}
          onClick={() => toggle({ type: "done" })}
        >
          <span>Выполнено</span>
          <span className="ts-row-count urgency-ok">{counts.done}</span>
        </button>
        {counts.overdue > 0 && (
          <button
            type="button"
            className={`ts-row${eq(filter, { type: "overdue" }) ? " active" : ""}`}
            onClick={() => toggle({ type: "overdue" })}
          >
            <span>Просрочено</span>
            <span className="ts-row-count urgency-bad">{counts.overdue}</span>
          </button>
        )}
        {counts.week > 0 && (
          <button
            type="button"
            className={`ts-row${eq(filter, { type: "week" }) ? " active" : ""}`}
            onClick={() => toggle({ type: "week" })}
          >
            <span>На неделе</span>
            <span className="ts-row-count urgency-warn">{counts.week}</span>
          </button>
        )}
      </div>

      <div className="ts-card">
        <h4>По категориям</h4>
        {areas.map((a) => (
          <button
            key={a.id}
            type="button"
            className={`ts-row${eq(filter, { type: "cat", val: a.id }) ? " active" : ""}`}
            onClick={() => toggle({ type: "cat", val: a.id })}
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
        <h4>По приоритету</h4>
        {PRIO_ROWS.map((p) => (
          <button
            key={p.key}
            type="button"
            className={`ts-row${eq(filter, { type: "prio", val: p.key }) ? " active" : ""}`}
            onClick={() => toggle({ type: "prio", val: p.key })}
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
