import { useMemo } from "react";
import type { TaskEntity } from "../../schemas";
import { useEntityStore } from "../../store/entities";
import { useUIStore } from "../../store/ui";

export function TasksHeader() {
  const entities = useEntityStore((s) => s.entities);
  const filter = useUIStore((s) => s.taskFilter);
  const clearAll = useUIStore((s) => s.clearTaskFilters);

  const activeCount = useMemo(
    () =>
      entities.filter(
        (e): e is TaskEntity => e.type === "task" && e.status !== "done",
      ).length,
    [entities],
  );

  const hasFilter =
    filter.status !== null || filter.cat !== null || filter.prio !== null;

  return (
    <div className="tasks-header">
      <h1 className="tasks-title">Задачи</h1>
      <span className="tasks-count">{activeCount} активных</span>
      {hasFilter && (
        <button
          type="button"
          className="filter-chip tasks-clear"
          onClick={clearAll}
        >
          ✕ Сбросить
        </button>
      )}
    </div>
  );
}
