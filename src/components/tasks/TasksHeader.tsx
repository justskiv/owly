import { useUIStore } from "../../store/ui";

export function TasksHeader({ count }: { count: number }) {
  const filter = useUIStore((s) => s.taskFilter);
  const clearAll = useUIStore((s) => s.clearTaskFilters);

  const hasFilter =
    filter.status !== null || filter.cat !== null || filter.prio !== null;

  return (
    <div className="tasks-header">
      <h1 className="tasks-title">Задачи</h1>
      <span className="tasks-count">{count}</span>
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
