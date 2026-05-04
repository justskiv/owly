import { useEffect, useState, type KeyboardEvent } from "react";
import type { BlockStatus } from "../../schemas";
import { useScheduleStore } from "../../store/schedule";
import { useUIStore } from "../../store/ui";
import { useConfigStore } from "../../store/config";

const EMPTY_AREAS: never[] = [];
import {
  END_HOUR,
  MIN_BLOCK_MIN,
  SNAP_MIN,
  START_HOUR,
  parseHHMMStrict,
  timeToMinutes,
} from "../../services/time-utils";
import { toast } from "../shared/Toast";
import { EntityPopup } from "../shared/EntityPopup";
import { errMsg } from "../../services/format";

export function BlockPopupHost() {
  const state = useUIStore((s) => s.blockPopup);
  const close = useUIStore((s) => s.closeBlockPopup);
  if (!state.open) return null;
  return (
    <EntityPopup
      anchor={state.anchor}
      position={state.position}
      onClose={close}
    >
      <BlockPopupContent blockId={state.blockId} onClose={close} />
    </EntityPopup>
  );
}

function BlockPopupContent({
  blockId,
  onClose,
}: {
  blockId: string;
  onClose: () => void;
}) {
  const block = useScheduleStore((s) =>
    s.blocks.find((b) => b.id === blockId),
  );
  const updateBlock = useScheduleStore((s) => s.updateBlock);
  const deleteBlock = useScheduleStore((s) => s.deleteBlock);
  // Stable selector — the `?? []` fallback would create a fresh
  // reference each render and trip React 19's getSnapshot guard.
  const config = useConfigStore((s) => s.config);
  const areas = config?.areas ?? EMPTY_AREAS;

  const [title, setTitle] = useState(block?.title ?? "");
  const [start, setStart] = useState(block?.start ?? "");
  const [duration, setDuration] = useState(
    block ? String(block.duration) : "",
  );
  const [category, setCategory] = useState(block?.category ?? "work");
  const [status, setStatus] = useState<BlockStatus>(block?.status ?? "planned");

  // Reset drafts when popup is reused for a different block. Editing
  // the same block's drafts shouldn't clobber on every blocks-array
  // mutation — same pattern as the entity popups.
  useEffect(() => {
    if (!block) return;
    setTitle(block.title);
    setStart(block.start);
    setDuration(String(block.duration));
    setCategory(block.category);
    setStatus(block.status);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [blockId]);

  if (!block) {
    return (
      <div className="ep-stub">
        <button
          type="button"
          className="ep-close"
          onClick={onClose}
          aria-label="Закрыть"
        >
          ×
        </button>
        <div className="ep-hint">Блок не найден</div>
      </div>
    );
  }

  // Wrap a persist promise so a failed disk write surfaces a toast
  // and snaps the local draft back to the last known good value
  // from the prop. Without this, the input keeps showing the
  // user-typed value while the store and disk hold the old one.
  const handlePersistError = (e: unknown, reset: () => void) => {
    toast.error(`Не удалось: ${errMsg(e)}`);
    reset();
  };

  const persistTitle = () => {
    const t = title.trim();
    if (t && t !== block.title) {
      void updateBlock(blockId, { title: t }).catch((e) =>
        handlePersistError(e, () => setTitle(block.title)),
      );
    } else {
      setTitle(block.title);
    }
  };

  const persistStart = () => {
    const min = parseHHMMStrict(start);
    if (min === null) {
      setStart(block.start);
      return;
    }
    const snapped = Math.round(min / SNAP_MIN) * SNAP_MIN;
    if (snapped < START_HOUR * 60 || snapped + block.duration > END_HOUR * 60) {
      toast.error("Время вне сетки");
      setStart(block.start);
      return;
    }
    const hh = String(Math.floor(snapped / 60)).padStart(2, "0");
    const mm = String(snapped % 60).padStart(2, "0");
    const next = `${hh}:${mm}`;
    if (next !== block.start) {
      void updateBlock(blockId, { start: next }).catch((e) =>
        handlePersistError(e, () => setStart(block.start)),
      );
    }
    setStart(next);
  };

  const persistDuration = () => {
    const raw = parseInt(duration, 10);
    if (!Number.isFinite(raw)) {
      setDuration(String(block.duration));
      return;
    }
    let snapped = Math.round(raw / SNAP_MIN) * SNAP_MIN;
    if (snapped < MIN_BLOCK_MIN) snapped = MIN_BLOCK_MIN;
    const startMin = timeToMinutes(block.start);
    const max = END_HOUR * 60 - startMin;
    if (snapped > max) snapped = max;
    setDuration(String(snapped));
    if (snapped !== block.duration) {
      void updateBlock(blockId, { duration: snapped }).catch((e) =>
        handlePersistError(e, () =>
          setDuration(String(block.duration)),
        ),
      );
    }
  };

  const persistCategory = (next: string) => {
    setCategory(next);
    if (next !== block.category) {
      void updateBlock(blockId, { category: next }).catch((e) =>
        handlePersistError(e, () => setCategory(block.category)),
      );
    }
  };

  const persistStatus = (next: BlockStatus) => {
    setStatus(next);
    if (next !== block.status) {
      void updateBlock(blockId, { status: next }).catch((e) =>
        handlePersistError(e, () => setStatus(block.status)),
      );
    }
  };

  const onEnter = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.nativeEvent.isComposing) return;
    if (e.key === "Enter") {
      e.preventDefault();
      (e.target as HTMLInputElement).blur();
    }
  };

  const onDelete = async () => {
    try {
      await deleteBlock(blockId);
      toast.success(`Удалён: ${block.title}`);
      onClose();
    } catch (e) {
      toast.error(`Не удалось: ${errMsg(e)}`);
    }
  };

  return (
    <div className="ep-task block-popup" role="document">
      <div className="ep-task-head">
        <input
          className="ep-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={persistTitle}
          onKeyDown={onEnter}
          aria-label="Название"
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

      <div className="bp-row">
        <label htmlFor="bp-cat">Категория</label>
        <select
          id="bp-cat"
          value={category}
          onChange={(e) => persistCategory(e.target.value)}
        >
          {areas.map((a) => (
            <option key={a.id} value={a.id}>
              {a.label}
            </option>
          ))}
        </select>
      </div>

      <div className="bp-time-row">
        <div className="bp-row">
          <label htmlFor="bp-start">Начало</label>
          <input
            id="bp-start"
            type="text"
            value={start}
            onChange={(e) => setStart(e.target.value)}
            onBlur={persistStart}
            onKeyDown={onEnter}
            placeholder="HH:MM"
          />
        </div>
        <div className="bp-row">
          <label htmlFor="bp-dur">Длит, мин</label>
          <input
            id="bp-dur"
            type="number"
            min={MIN_BLOCK_MIN}
            step={SNAP_MIN}
            value={duration}
            onChange={(e) => setDuration(e.target.value)}
            onBlur={persistDuration}
            onKeyDown={onEnter}
          />
        </div>
      </div>

      <div className="bp-row">
        <label htmlFor="bp-status">Статус</label>
        <select
          id="bp-status"
          value={status}
          onChange={(e) => persistStatus(e.target.value as BlockStatus)}
        >
          <option value="planned">Запланировано</option>
          <option value="done">Готово</option>
          <option value="skipped">Пропущено</option>
          <option value="moved">Перенесено</option>
        </select>
      </div>

      <div className="ep-actions">
        <button type="button" className="ep-delete" onClick={onDelete}>
          <span>Удалить</span>
        </button>
      </div>
    </div>
  );
}
