import { useMemo } from "react";
import { useEntityStore } from "../store/entities";
import { useAreas } from "../store/config";
import { useUIStore } from "../store/ui";
import {
  applyProjectFilters,
  projectsForBoard,
  STALE_THRESHOLD_DAYS,
} from "../services/projects-helpers";
import { BoardBar } from "../components/projects/BoardBar";
import { SummaryBar } from "../components/projects/SummaryBar";
import { Kanban } from "../components/projects/Kanban";

export function ProjectsPage() {
  const entities = useEntityStore((s) => s.entities);
  const areas = useAreas();
  const activeBoard = useUIStore((s) => s.activeBoard);
  const catFilter = useUIStore((s) => s.catFilter);
  const staleFilter = useUIStore((s) => s.staleFilter);

  const projectsOnBoard = useMemo(
    () => projectsForBoard(entities, activeBoard),
    [entities, activeBoard],
  );
  // Cat-filtered set is the basis for both the summary number and the
  // stale count — staleFilter only narrows the *visible* kanban, not
  // what the user thinks of as "active on this board".
  const visibleByCat = useMemo(
    () => applyProjectFilters(projectsOnBoard, catFilter, false),
    [projectsOnBoard, catFilter],
  );
  const filtered = useMemo(
    () => (staleFilter ? applyProjectFilters(visibleByCat, null, true) : visibleByCat),
    [visibleByCat, staleFilter],
  );
  const staleCount = useMemo(
    () =>
      visibleByCat.filter(
        (p) => p.fields.last_activity_days >= STALE_THRESHOLD_DAYS,
      ).length,
    [visibleByCat],
  );

  if (areas.length === 0) {
    return (
      <div className="projects-page">
        <div className="projects-empty-stub">
          Сначала добавьте области в Settings
        </div>
      </div>
    );
  }

  const defaultCategory =
    areas.find((a) => a.id === "work")?.id ?? areas[0].id;

  return (
    <div className="projects-page">
      <BoardBar areas={areas} />
      <SummaryBar total={visibleByCat.length} stale={staleCount} />
      <Kanban
        boardId={activeBoard}
        projects={filtered}
        defaultCategory={defaultCategory}
        areas={areas}
      />
    </div>
  );
}
