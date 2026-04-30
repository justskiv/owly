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

const FILTER_LABEL: Record<"overdue" | "week" | "done", string> = {
  overdue: "Просрочено",
  week: "На неделе",
  done: "Выполнено",
};

export function TasksHeader() {
  const entities = useEntityStore((s) => s.entities);
  const filter = useUIStore((s) => s.taskFilter);
  const setFilter = useUIStore((s) => s.setTaskFilter);
  const areas = useConfigStore((s) => s.config?.areas ?? []);

  const activeCount = useMemo(
    () =>
      entities.filter(
        (e): e is TaskEntity => e.type === "task" && e.status !== "done",
      ).length,
    [entities],
  );

  let chipLabel: string | null = null;
  if (filter) {
    if (filter.type === "cat") chipLabel = getAreaLabel(filter.val, areas);
    else if (filter.type === "prio") chipLabel = PRIO_LABEL[filter.val];
    else chipLabel = FILTER_LABEL[filter.type];
  }

  return (
    <div className="tasks-header">
      <h1 className="tasks-title">Задачи</h1>
      <span className="tasks-count">{activeCount} активных</span>
      {chipLabel && (
        <button
          type="button"
          className="filter-chip"
          onClick={() => setFilter(null)}
        >
          ✕ {chipLabel}
        </button>
      )}
    </div>
  );
}
