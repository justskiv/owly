import { useMemo } from "react";
import type { TaskEntity } from "../../schemas";
import { useEntityStore } from "../../store/entities";
import { useConfigStore } from "../../store/config";
import { useUIStore } from "../../store/ui";
import { getAreaLabel } from "../../services/categories";

const PRIO_LABEL: Record<"high" | "medium" | "low", string> = {
  high: "Высокий",
  medium: "Средний",
  low: "Низкий",
};

const STATUS_LABEL: Record<"overdue" | "week" | "done", string> = {
  overdue: "Просрочено",
  week: "На неделе",
  done: "Выполнено",
};

const EMPTY_AREAS: never[] = [];

export function TasksHeader() {
  const entities = useEntityStore((s) => s.entities);
  const filter = useUIStore((s) => s.taskFilter);
  const setStatus = useUIStore((s) => s.setTaskFilterStatus);
  const setCat = useUIStore((s) => s.setTaskFilterCat);
  const setPrio = useUIStore((s) => s.setTaskFilterPrio);
  const areas = useConfigStore((s) => s.config?.areas ?? EMPTY_AREAS);

  const activeCount = useMemo(
    () =>
      entities.filter(
        (e): e is TaskEntity => e.type === "task" && e.status !== "done",
      ).length,
    [entities],
  );

  return (
    <div className="tasks-header">
      <h1 className="tasks-title">Задачи</h1>
      <span className="tasks-count">{activeCount} активных</span>
      <div className="tasks-chips">
        {filter.status && (
          <button
            type="button"
            className="filter-chip"
            onClick={() => setStatus(null)}
          >
            ✕ {STATUS_LABEL[filter.status]}
          </button>
        )}
        {filter.cat && (
          <button
            type="button"
            className="filter-chip"
            onClick={() => setCat(null)}
          >
            ✕ {getAreaLabel(filter.cat, areas)}
          </button>
        )}
        {filter.prio && (
          <button
            type="button"
            className="filter-chip"
            onClick={() => setPrio(null)}
          >
            ✕ {PRIO_LABEL[filter.prio]}
          </button>
        )}
      </div>
    </div>
  );
}
