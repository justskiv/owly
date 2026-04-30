import { useMemo } from "react";
import type { Area, PoolItem, ProjectEntity } from "../../schemas";
import { getBoardById } from "../../services/boards";
import { projectsForColumn } from "../../services/projects-helpers";
import { usePoolStore } from "../../store/pool";
import { useKanbanGesture } from "../../hooks/useKanbanGesture";
import { KanbanColumn } from "./KanbanColumn";

interface Props {
  boardId: string;
  projects: ProjectEntity[];
  defaultCategory: string;
  areas: readonly Area[];
}

export function Kanban({ boardId, projects, defaultCategory, areas }: Props) {
  // Single gesture controller for the whole board — analogous to how
  // PlannerPage owns useBlockGesture for the whole grid.
  const { draggingProjectId, dropColumnIndex, onCardPointerDown } =
    useKanbanGesture(areas);

  const board = getBoardById(boardId);

  // Bucket once per render — without this, projectsForColumn ran for
  // each column inline in JSX and returned a fresh array, breaking
  // memoization on KanbanColumn / KanbanCard.
  const buckets = useMemo<ProjectEntity[][]>(() => {
    if (!board) return [];
    return board.columns.map((_, idx) =>
      projectsForColumn(projects, boardId, idx),
    );
  }, [board, projects, boardId]);

  // One subscription for the whole board's pool data; without this,
  // every card subscribed to the pool store and ran .find() on every
  // pool mutation.
  const poolItems = usePoolStore((s) => s.items);
  const poolByProjectId = useMemo(() => {
    const map = new Map<string, PoolItem>();
    for (const item of poolItems) {
      if (item.source_kind === "project" && item.source_entity_id) {
        map.set(item.source_entity_id, item);
      }
    }
    return map;
  }, [poolItems]);

  if (!board) return null;

  return (
    <div className="kanban">
      {board.columns.map((title, idx) => (
        <KanbanColumn
          key={`${boardId}:${title}`}
          boardId={boardId}
          columnIndex={idx}
          title={title}
          projects={buckets[idx]}
          defaultCategory={defaultCategory}
          areas={areas}
          draggingProjectId={draggingProjectId}
          dropColumnIndex={dropColumnIndex}
          onCardPointerDown={onCardPointerDown}
          poolByProjectId={poolByProjectId}
        />
      ))}
    </div>
  );
}
