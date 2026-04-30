import { useMemo } from "react";
import { useEntityStore } from "../store/entities";
import { useConfigStore } from "../store/config";
import { useUIStore } from "../store/ui";
import {
  applyProjectFilters,
  projectsForBoard,
  STALE_THRESHOLD_DAYS,
} from "../services/projects-helpers";
import { BoardBar } from "../components/projects/BoardBar";
import { SummaryBar } from "../components/projects/SummaryBar";
import { Kanban } from "../components/projects/Kanban";

const EMPTY_AREAS: never[] = [];

export function ProjectsPage() {
  const entities = useEntityStore((s) => s.entities);
  const areas = useConfigStore((s) => s.config?.areas ?? EMPTY_AREAS);
  const activeBoard = useUIStore((s) => s.activeBoard);
  const catFilter = useUIStore((s) => s.catFilter);
  const staleFilter = useUIStore((s) => s.staleFilter);

  const projectsOnBoard = useMemo(
    () => projectsForBoard(entities, activeBoard),
    [entities, activeBoard],
  );
  const filtered = useMemo(
    () => applyProjectFilters(projectsOnBoard, catFilter, staleFilter),
    [projectsOnBoard, catFilter, staleFilter],
  );
  const staleCount = useMemo(
    () =>
      projectsOnBoard.filter(
        (p) => p.fields.last_activity_days >= STALE_THRESHOLD_DAYS,
      ).length,
    [projectsOnBoard],
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
      <SummaryBar total={filtered.length} stale={staleCount} />
      <Kanban
        boardId={activeBoard}
        projects={filtered}
        defaultCategory={defaultCategory}
        areas={areas}
      />
    </div>
  );
}
