import { useEffect, useMemo, useState, type KeyboardEvent } from "react";
import type { DirectionEntity, ProjectEntity } from "../../../schemas";
import { useEntityStore } from "../../../store/entities";
import { useAreas } from "../../../store/config";
import { BOARDS, getBoardById } from "../../../services/boards";
import { errMsg } from "../../../services/format";
import { toast } from "../../shared/Toast";

// Surface a failed updateEntity to the user and let the caller reset
// the draft to the last known good value. Mirrors BlockPopup —
// without it, a save failure left the visible draft diverged from
// the persisted state and the user wouldn't know.
const handlePersistError = (e: unknown, reset?: () => void) => {
  toast.error(`Не удалось: ${errMsg(e)}`);
  reset?.();
};

interface Props {
  project: ProjectEntity;
  onClose: () => void;
}

export function ProjectPopup({ project, onClose }: Props) {
  const updateEntity = useEntityStore((s) => s.updateEntity);
  const entities = useEntityStore((s) => s.entities);
  const areas = useAreas();
  const [titleDraft, setTitleDraft] = useState(project.title);

  // Reset only when the popup is reused for a different project.
  // Resetting on every `project.title` change would clobber typing
  // during the persist round-trip.
  useEffect(() => {
    setTitleDraft(project.title);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project.id]);

  const directions = useMemo(
    () =>
      entities
        .filter((e): e is DirectionEntity => e.type === "direction")
        .sort((a, b) => a.title.localeCompare(b.title)),
    [entities],
  );

  const tags = project.tags;
  const areaIds = useMemo(() => new Set(areas.map((a) => a.id)), [areas]);
  const activeCat = tags.find((t) => areaIds.has(t)) ?? null;

  // Read fresh entity at write time. The popup's `project` prop is a
  // closure snapshot; if the user changes board AND immediately changes
  // direction, the second writer would otherwise spread stale fields
  // and clobber the board change.
  const fresh = (): ProjectEntity | null => {
    const e = useEntityStore
      .getState()
      .entities.find((x) => x.id === project.id);
    return e && e.type === "project" ? e : null;
  };

  const setCategory = (id: string) => {
    const cur = fresh();
    if (!cur) return;
    const nonArea = cur.tags.filter((t) => !areaIds.has(t));
    void updateEntity(project.id, { tags: [...nonArea, id] }).catch((e) =>
      handlePersistError(e),
    );
  };

  const setBoard = (newBoardId: string) => {
    const cur = fresh();
    if (!cur) return;
    const newBoard = getBoardById(newBoardId);
    if (!newBoard) return;
    const col =
      cur.fields.column_index >= newBoard.columns.length
        ? 0
        : cur.fields.column_index;
    void updateEntity(project.id, {
      fields: { ...cur.fields, board_id: newBoardId, column_index: col },
    }).catch((e) => handlePersistError(e));
  };

  const setDirection = (id: string) => {
    const cur = fresh();
    if (!cur) return;
    void updateEntity(project.id, {
      fields: { ...cur.fields, direction_id: id || null },
    }).catch((e) => handlePersistError(e));
  };

  const persistTitle = () => {
    const t = titleDraft.trim();
    if (t && t !== project.title) {
      void updateEntity(project.id, { title: t }).catch((e) =>
        handlePersistError(e, () => setTitleDraft(project.title)),
      );
    } else {
      setTitleDraft(project.title);
    }
  };

  const onTitleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.nativeEvent.isComposing) return;
    if (e.key === "Enter") {
      e.preventDefault();
      (e.target as HTMLInputElement).blur();
    }
  };

  return (
    <div className="ep-task" role="document">
      <div className="ep-task-head">
        <input
          className="ep-title"
          value={titleDraft}
          onChange={(e) => setTitleDraft(e.target.value)}
          onBlur={persistTitle}
          onKeyDown={onTitleKeyDown}
          aria-label="Название проекта"
          maxLength={200}
        />
        <button
          type="button"
          className="ep-close"
          onClick={onClose}
          aria-label="Закрыть"
        >
          ×
        </button>
      </div>

      <div className="ep-field">
        <div className="ep-label">Категория</div>
        <div className="ep-cat-dots">
          {areas.map((a) => (
            <button
              key={a.id}
              type="button"
              className={`ep-cat-dot${activeCat === a.id ? " on" : ""}`}
              style={{ background: a.color }}
              onClick={() => setCategory(a.id)}
              aria-label={a.label}
              aria-pressed={activeCat === a.id}
              title={a.label}
            />
          ))}
        </div>
      </div>

      <div className="ep-field">
        <div className="ep-label">Доска</div>
        <select
          className="ep-board"
          value={project.fields.board_id}
          onChange={(e) => setBoard(e.target.value)}
        >
          {BOARDS.map((b) => (
            <option key={b.id} value={b.id}>
              {b.title}
            </option>
          ))}
        </select>
      </div>

      <div className="ep-field">
        <div className="ep-label">Направление</div>
        <select
          className="ep-direction"
          value={project.fields.direction_id ?? ""}
          onChange={(e) => setDirection(e.target.value)}
        >
          <option value="">—</option>
          {directions.map((d) => (
            <option key={d.id} value={d.id}>
              {d.title}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
