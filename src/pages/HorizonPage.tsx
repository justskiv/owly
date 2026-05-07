import type { MouseEvent } from "react";
import { useMemo } from "react";
import type { ProjectEntity } from "../schemas";
import { useConfigStore } from "../store/config";
import { useEntityStore } from "../store/entities";
import { useHorizonStore } from "../store/horizon";
import { useUIStore } from "../store/ui";
import { useHorizonDrag } from "../hooks/useHorizonDrag";
import { HorizonBoard } from "../components/horizon/HorizonBoard";
import { Backlog } from "../components/horizon/Backlog";

const EMPTY_AREAS: never[] = [];

export function HorizonPage() {
  const states = useHorizonStore((s) => s.projects);
  const baseMonth = useHorizonStore((s) => s.baseMonth);
  const entities = useEntityStore((s) => s.entities);
  const config = useConfigStore((s) => s.config);
  const areas = config?.areas ?? EMPTY_AREAS;
  const highlight = useUIStore((s) => s.horizonHighlight);
  const setHorizonHighlight = useUIStore((s) => s.setHorizonHighlight);

  const projectsById = useMemo(() => {
    const m = new Map<string, ProjectEntity>();
    for (const e of entities) {
      if (e.type === "project") m.set(e.id, e);
    }
    return m;
  }, [entities]);

  const { draggingProjectId, dropMonthIndex, onItemPointerDown } =
    useHorizonDrag();

  // Click anywhere outside a td (or interactive element inside the
  // backlog) clears the fixed highlight — matches the mock's
  // click-on-empty-board behaviour. Without this the only way to drop
  // a click-locked highlight is clicking the same backlog item again.
  const onPageClick = (e: MouseEvent) => {
    if (!highlight) return;
    const target = e.target as HTMLElement;
    if (
      target.closest("td") ||
      target.closest(".hz-bl-item") ||
      target.closest(".bl-section-head")
    ) {
      return;
    }
    setHorizonHighlight(null);
  };

  return (
    <div
      className="horizon-view"
      data-screen="horizon"
      onClick={onPageClick}
    >
      <HorizonBoard
        states={states}
        projectsById={projectsById}
        baseMonth={baseMonth}
        areas={areas}
        highlightedProjectId={highlight?.projectId ?? null}
        dropMonthIndex={dropMonthIndex}
      />
      <Backlog
        states={states}
        projectsById={projectsById}
        baseMonth={baseMonth}
        areas={areas}
        highlightedProjectId={highlight?.projectId ?? null}
        draggingProjectId={draggingProjectId}
        dragInProgress={draggingProjectId !== null}
        onItemPointerDown={onItemPointerDown}
      />
    </div>
  );
}
