import { useMemo } from "react";
import { Archive } from "lucide-react";
import type { TaskEntity } from "../../schemas";
import { useEntityStore } from "../../store/entities";
import { useConfigStore } from "../../store/config";
import {
  useUIStore,
  type TaskPrioFilter,
  type TaskStatusFilter,
} from "../../store/ui";
import { daysUntil } from "../../services/urgency";

const PRIO_ROWS: Array<{
  key: TaskPrioFilter;
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
  const setTasksView = useUIStore((s) => s.setTasksView);

  // Faceted counts: each row shows "what the visible count would be
  // if I picked this row's value for its slot, keeping the other two
  // slots at their current values". Mirrors the AND filter pipeline
  // in TasksPage so the displayed numbers always sum to what the
  // list will actually render.
  const { countWith, totalOverdue, totalWeek, totalDone } = useMemo(() => {
    const allTasks = entities.filter(
      (e): e is TaskEntity => e.type === "task",
    );
    const allActive = allTasks.filter((t) => t.status !== "done");
    const doneCount = allTasks.filter((t) => t.status === "done").length;

    const apply = (
      statusF: TaskStatusFilter | null,
      catF: string | null,
      prioF: TaskPrioFilter | null,
    ): number => {
      let pool = allActive;
      if (statusF === "overdue") {
        pool = pool.filter((t) => {
          const d = daysUntil(t.deadline);
          return d !== null && d < 0;
        });
      } else if (statusF === "week") {
        pool = pool.filter((t) => {
          const d = daysUntil(t.deadline);
          return d !== null && d >= 0 && d <= 7;
        });
      }
      if (catF) pool = pool.filter((t) => t.tags.includes(catF));
      if (prioF) pool = pool.filter((t) => t.priority === prioF);
      return pool.length;
    };

    let overdue = 0;
    let week = 0;
    for (const t of allActive) {
      const d = daysUntil(t.deadline);
      if (d === null) continue;
      if (d < 0) overdue++;
      else if (d <= 7) week++;
    }

    return {
      countWith: apply,
      totalOverdue: overdue,
      totalWeek: week,
      totalDone: doneCount,
    };
  }, [entities]);

  return (
    <aside className="tasks-side">
      <div className="ts-card">
        <h4>Статус</h4>
        <button
          type="button"
          className={`ts-row${filter.status === null ? " active" : ""}`}
          onClick={() => setStatus(null)}
        >
          <span>Все</span>
          <span className="ts-row-count">
            {countWith(null, filter.cat, filter.prio)}
          </span>
        </button>
        {totalOverdue > 0 && (
          <button
            type="button"
            className={`ts-row${filter.status === "overdue" ? " active" : ""}`}
            onClick={() =>
              setStatus(filter.status === "overdue" ? null : "overdue")
            }
          >
            <span>Просрочено</span>
            <span className="ts-row-count urgency-bad">
              {countWith("overdue", filter.cat, filter.prio)}
            </span>
          </button>
        )}
        {totalWeek > 0 && (
          <button
            type="button"
            className={`ts-row${filter.status === "week" ? " active" : ""}`}
            onClick={() =>
              setStatus(filter.status === "week" ? null : "week")
            }
          >
            <span>На неделе</span>
            <span className="ts-row-count urgency-warn">
              {countWith("week", filter.cat, filter.prio)}
            </span>
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
              {countWith(filter.status, a.id, filter.prio)}
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
            <span className="ts-row-count">
              {countWith(filter.status, filter.cat, p.key)}
            </span>
          </button>
        ))}
      </div>

      <button
        type="button"
        className="ts-archive-link"
        onClick={() => setTasksView("archive")}
      >
        <Archive size={14} aria-hidden />
        <span>Архив выполненных</span>
        <span className="ts-archive-link-count">{totalDone}</span>
      </button>
    </aside>
  );
}
