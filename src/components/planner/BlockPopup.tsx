import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
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

interface StatusOption {
  value: BlockStatus;
  label: string;
}

// Labels are length-tuned to fit four equal-width buttons in the
// 260px popup. Icons are dropped — the toggle group's accent border
// already signals which value is active, and the status row label
// above tells the user what these are.
const STATUS_OPTIONS: ReadonlyArray<StatusOption> = [
  { value: "planned", label: "План" },
  { value: "done", label: "Готово" },
  { value: "skipped", label: "Пропуск" },
  { value: "moved", label: "Перенос" },
];

// Auto-grow ceiling for the notes textarea. Anything taller turns
// into an inner scrollbar — keeps the popup compact.
const NOTES_MAX_PX = 160;

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
  const [notes, setNotes] = useState(block?.notes ?? "");

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
    setNotes(block.notes);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [blockId]);

  // Auto-grow notes textarea: clear inline height (so scrollHeight
  // reflects content, not the prior cap), then snap to clamped
  // scrollHeight. Re-runs on every notes change AND on blockId
  // change (the reset effect above swaps the value, height must
  // follow). useLayoutEffect avoids a flicker between the old and
  // new height before paint.
  const notesElRef = useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(() => {
    const el = notesElRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, NOTES_MAX_PX)}px`;
  }, [notes, blockId]);

  // Draft refs — fed into the unmount-cleanup flush so a textarea or
  // input blur that never fires (because the popup unmounts on
  // outside-click before React sees the synthetic blur) still
  // persists its typed value. category/status persist on click and
  // skip this path. All field validations mirror the per-blur
  // persist* helpers above; on rejection we silently drop, since
  // the popup is gone and there is no UI left to reset draft state.
  const draftsRef = useRef({ title, start, duration, notes });
  draftsRef.current = { title, start, duration, notes };
  useEffect(() => {
    return () => {
      const drafts = draftsRef.current;
      const fresh = useScheduleStore
        .getState()
        .blocks.find((b) => b.id === blockId);
      if (!fresh) return;
      const updates: Partial<{
        title: string;
        start: string;
        duration: number;
        notes: string;
      }> = {};

      const t = drafts.title.trim();
      if (t && t !== fresh.title) updates.title = t;

      const startMin = parseHHMMStrict(drafts.start);
      if (startMin !== null) {
        const snapped = Math.round(startMin / SNAP_MIN) * SNAP_MIN;
        if (
          snapped >= START_HOUR * 60 &&
          snapped + fresh.duration <= END_HOUR * 60
        ) {
          const hh = String(Math.floor(snapped / 60)).padStart(2, "0");
          const mm = String(snapped % 60).padStart(2, "0");
          const next = `${hh}:${mm}`;
          if (next !== fresh.start) updates.start = next;
        }
      }

      const durRaw = parseInt(drafts.duration, 10);
      if (Number.isFinite(durRaw)) {
        let snapped = Math.round(durRaw / SNAP_MIN) * SNAP_MIN;
        if (snapped < MIN_BLOCK_MIN) snapped = MIN_BLOCK_MIN;
        const startMinFresh = timeToMinutes(fresh.start);
        const max = END_HOUR * 60 - startMinFresh;
        if (snapped > max) snapped = max;
        if (snapped !== fresh.duration) updates.duration = snapped;
      }

      if (drafts.notes !== fresh.notes) updates.notes = drafts.notes;

      if (Object.keys(updates).length === 0) return;
      void useScheduleStore
        .getState()
        .updateBlock(blockId, updates)
        .catch(() => {
          // Popup is gone; saveStatus surfaces errors in StatusBar.
        });
    };
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

  const persistNotes = () => {
    if (notes !== block.notes) {
      void updateBlock(blockId, { notes }).catch((e) =>
        handlePersistError(e, () => setNotes(block.notes)),
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
        <label id="bp-cat-label">Категория</label>
        <div
          className="f-cats"
          role="radiogroup"
          aria-labelledby="bp-cat-label"
        >
          {areas.map((a) => {
            const active = category === a.id;
            return (
              <button
                type="button"
                key={a.id}
                role="radio"
                aria-checked={active}
                className={`f-cat${active ? " active" : ""}`}
                style={active ? { color: a.color } : undefined}
                onClick={() => persistCategory(a.id)}
              >
                <span className="cd" style={{ background: a.color }} />
                {a.label}
              </button>
            );
          })}
        </div>
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
        <label id="bp-status-label">Статус</label>
        <div
          className="bp-status-toggle"
          role="radiogroup"
          aria-labelledby="bp-status-label"
        >
          {STATUS_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              role="radio"
              aria-checked={status === opt.value}
              className={status === opt.value ? "active" : ""}
              onClick={() => persistStatus(opt.value)}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div className="bp-row">
        <label htmlFor="bp-notes">Заметки</label>
        <textarea
          ref={notesElRef}
          id="bp-notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          onBlur={persistNotes}
          placeholder="..."
        />
      </div>

      <div className="ep-actions">
        <button type="button" className="ep-delete" onClick={onDelete}>
          <span>Удалить</span>
        </button>
      </div>
    </div>
  );
}
