import { useEffect, useMemo } from "react";
import type { TaskEntity } from "../schemas";
import { useEntityStore } from "../store/entities";
import { useConfigStore } from "../store/config";
import { useUIStore } from "../store/ui";
import { groupTasks, type TaskGroups } from "../services/group-tasks";
import { daysUntil } from "../services/urgency";
import { TasksHeader } from "../components/tasks/TasksHeader";
import { TaskBar } from "../components/tasks/TaskBar";
import { TaskGroupsView } from "../components/tasks/TaskGroups";
import { TasksSidebar } from "../components/tasks/TasksSidebar";

const EMPTY_GROUPS: TaskGroups = {
  burning: [],
  urgent: [],
  soon: [],
  notSoon: [],
  someday: [],
  done: [],
};

export function TasksPage() {
  // Selecting `entities` directly (a stable reference) and filtering
  // in useMemo. A `.filter` inside the selector returns a fresh array
  // on every render and trips Zustand's getSnapshot caching → infinite
  // loop.
  const entities = useEntityStore((s) => s.entities);
  const tasks = useMemo(
    () => entities.filter((e): e is TaskEntity => e.type === "task"),
    [entities],
  );
  const config = useConfigStore((s) => s.config);
  const taskAddCat = useUIStore((s) => s.taskAddCat);
  const setTaskAddCat = useUIStore((s) => s.setTaskAddCat);
  const taskSearch = useUIStore((s) => s.taskSearch);
  const taskFilter = useUIStore((s) => s.taskFilter);

  // Wrapped so downstream effect/memo deps don't see a fresh array
  // every render (the `?? []` fallback would otherwise allocate on
  // each call and re-fire the init effect).
  const areas = useMemo(() => config?.areas ?? [], [config?.areas]);

  // Initialise taskAddCat once areas are available. Prefer 'life' per
  // spec §11.9; otherwise fall back to the first configured area.
  useEffect(() => {
    if (taskAddCat || areas.length === 0) return;
    const life = areas.find((a) => a.id === "life");
    setTaskAddCat(life?.id ?? areas[0].id);
  }, [taskAddCat, areas, setTaskAddCat]);

  const groups = useMemo<TaskGroups>(() => {
    if (areas.length === 0) return EMPTY_GROUPS;
    const allActive = tasks.filter((t) => t.status !== "done");
    const allDone = tasks.filter((t) => t.status === "done");

    if (taskFilter?.type === "done") {
      return groupTasks([], allDone);
    }

    let active = allActive;
    if (taskSearch) {
      const q = taskSearch.toLowerCase();
      active = active.filter((t) => t.title.toLowerCase().includes(q));
    }
    if (taskFilter) {
      switch (taskFilter.type) {
        case "cat":
          active = active.filter((t) => t.tags.includes(taskFilter.val));
          break;
        case "prio":
          active = active.filter((t) => t.priority === taskFilter.val);
          break;
        case "overdue":
          active = active.filter((t) => {
            const d = daysUntil(t.deadline);
            return d !== null && d < 0;
          });
          break;
        case "week":
          active = active.filter((t) => {
            const d = daysUntil(t.deadline);
            return d !== null && d >= 0 && d <= 7;
          });
          break;
      }
    }
    return groupTasks(active, allDone);
  }, [tasks, taskSearch, taskFilter, areas.length]);

  if (areas.length === 0) {
    return (
      <div className="tasks-page">
        <div className="tasks-empty-stub">
          Сначала добавьте области в Settings
        </div>
      </div>
    );
  }

  const empty =
    taskSearch || taskFilter ? "Нет задач по этому фильтру" : null;

  return (
    <div className="tasks-page">
      <div className="tasks-inner">
        <TasksHeader />
        <TaskBar />
        <TaskGroupsView groups={groups} empty={empty} />
      </div>
      <TasksSidebar />
    </div>
  );
}
