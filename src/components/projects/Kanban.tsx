import type { Area, ProjectEntity } from "../../schemas";
import { getBoardById } from "../../services/boards";
import { projectsForColumn } from "../../services/projects-helpers";
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
  if (!board) return null;
  return (
    <div className="kanban">
      {board.columns.map((title, idx) => (
        <KanbanColumn
          key={idx}
          boardId={boardId}
          columnIndex={idx}
          title={title}
          projects={projectsForColumn(projects, boardId, idx)}
          defaultCategory={defaultCategory}
          areas={areas}
          draggingProjectId={draggingProjectId}
          dropColumnIndex={dropColumnIndex}
          onCardPointerDown={onCardPointerDown}
        />
      ))}
    </div>
  );
}
