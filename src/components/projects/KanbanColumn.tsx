import type { PointerEvent as ReactPointerEvent } from "react";
import type { Area, ProjectEntity } from "../../schemas";
import { KanbanCard } from "./KanbanCard";
import { InlineAdd } from "./InlineAdd";

interface Props {
  boardId: string;
  columnIndex: number;
  title: string;
  projects: ProjectEntity[];
  defaultCategory: string;
  areas: readonly Area[];
  draggingProjectId: string | null;
  dropColumnIndex: number | null;
  onCardPointerDown: (
    e: ReactPointerEvent<HTMLDivElement>,
    project: ProjectEntity,
    open: () => void,
  ) => void;
}

export function KanbanColumn({
  boardId,
  columnIndex,
  title,
  projects,
  defaultCategory,
  areas,
  draggingProjectId,
  dropColumnIndex,
  onCardPointerDown,
}: Props) {
  const isOver = dropColumnIndex === columnIndex;
  return (
    <div className="kanban-col">
      <div className="kanban-col-head">
        <span>{title}</span>
        <span className="kanban-col-count">{projects.length}</span>
      </div>
      {/* data-column-index drives hit-testing in useKanbanGesture. */}
      <div
        className={`kanban-cards${isOver ? " drag-over" : ""}`}
        data-column-index={columnIndex}
      >
        {projects.map((p) => (
          <KanbanCard
            key={p.id}
            project={p}
            dragging={draggingProjectId === p.id}
            onPointerDown={onCardPointerDown}
          />
        ))}
        <InlineAdd
          boardId={boardId}
          columnIndex={columnIndex}
          defaultCategory={defaultCategory}
          areas={areas}
        />
      </div>
    </div>
  );
}
