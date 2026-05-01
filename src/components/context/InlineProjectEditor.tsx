import { useEffect, useState, type KeyboardEvent } from "react";
import type { ProjectEntity } from "../../schemas";
import { useEntityStore } from "../../store/entities";
import { BOARDS, getBoardById } from "../../services/boards";

interface Props {
  project: ProjectEntity;
}

export function InlineProjectEditor({ project }: Props) {
  const updateEntity = useEntityStore((s) => s.updateEntity);
  const [titleDraft, setTitleDraft] = useState(project.title);

  useEffect(() => {
    setTitleDraft(project.title);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project.id]);

  const fresh = (): ProjectEntity | null => {
    const e = useEntityStore
      .getState()
      .entities.find((x) => x.id === project.id);
    return e && e.type === "project" ? e : null;
  };

  const persistTitle = () => {
    const cur = fresh();
    if (!cur) return;
    const t = titleDraft.trim();
    // Compare against the FRESH current title, not the prop snapshot —
    // a background rename would otherwise be reverted by an unchanged
    // (relative to mount-time) draft.
    if (t && t !== cur.title) {
      void updateEntity(project.id, { title: t });
    } else {
      setTitleDraft(cur.title);
    }
  };

  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.nativeEvent.isComposing) return;
    if (e.key === "Enter") {
      e.preventDefault();
      (e.target as HTMLInputElement).blur();
    }
  };

  // Switching board resets column_index to 0 because the new board
  // may have fewer columns; mirroring ProjectPopup's setBoard keeps
  // the project visible after the move.
  const setBoard = (boardId: string) => {
    const cur = fresh();
    if (!cur || cur.fields.board_id === boardId) return;
    const target = getBoardById(boardId);
    if (!target) return;
    void updateEntity(project.id, {
      fields: { ...cur.fields, board_id: boardId, column_index: 0 },
    });
  };

  // Stop propagation so clicks inside the editor don't reach the
  // parent's document mousedown listener and close the editor.
  return (
    <div className="dc-proj-edit" onMouseDown={(e) => e.stopPropagation()}>
      <input
        className="dpe-title"
        value={titleDraft}
        onChange={(e) => setTitleDraft(e.target.value)}
        onBlur={persistTitle}
        onKeyDown={onKey}
        maxLength={200}
        aria-label="Название проекта"
      />
      <div className="dpe-tags">
        {BOARDS.map((b) => (
          <button
            key={b.id}
            type="button"
            className={`dpe-tag${
              project.fields.board_id === b.id ? " on" : ""
            }`}
            onClick={() => setBoard(b.id)}
          >
            {b.title}
          </button>
        ))}
      </div>
    </div>
  );
}
