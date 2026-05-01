// LEGACY — phase 6 backup, removed in phase 9
import { useEffect, useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import type { Area, Block, BlockStatus } from "../../schemas";
import { useFocusTrap } from "../../hooks/useFocusTrap";
import { useRestoreFocus } from "../../hooks/useRestoreFocus";
import { useScheduleStore } from "../../store/schedule";
import { useUIStore } from "../../store/ui";
import { toast } from "../shared/Toast";
import {
  DEFAULT_BLOCK_CATEGORY,
  DEFAULT_BLOCK_DURATION_MIN,
  MIN_BLOCK_MIN,
  clampBlockToGrid,
  dateForDayIndex,
  dayIndexOfDate,
  minutesToTime,
  parseHHMMStrict,
} from "../../services/time-utils";

export interface EditorPrefill {
  date?: string;
  start?: string;
  duration?: number;
  category?: string;
  title?: string;
  notes?: string;
}

export type EditorMode =
  | { kind: "new"; defaults: EditorPrefill }
  | { kind: "edit"; block: Block };

interface BlockEditorProps {
  mode: EditorMode;
  weekStart: string;
  areas: Area[];
  onClose: () => void;
}

export function BlockEditor({
  mode,
  weekStart,
  areas,
  onClose,
}: BlockEditorProps) {
  const isEdit = mode.kind === "edit";

  const initialDayIdx = isEdit
    ? Math.max(0, dayIndexOfDate(mode.block.date, weekStart))
    : mode.defaults.date
      ? Math.max(0, dayIndexOfDate(mode.defaults.date, weekStart))
      : 0;

  const [title, setTitle] = useState(
    isEdit ? mode.block.title : (mode.defaults.title ?? ""),
  );
  const [start, setStart] = useState(
    isEdit ? mode.block.start : (mode.defaults.start ?? "09:00"),
  );
  const [duration, setDuration] = useState(
    String(
      isEdit
        ? mode.block.duration
        : (mode.defaults.duration ?? DEFAULT_BLOCK_DURATION_MIN),
    ),
  );
  const [dayIdx, setDayIdx] = useState(String(initialDayIdx));
  const [category, setCategory] = useState(
    isEdit ? mode.block.category : (mode.defaults.category ?? DEFAULT_BLOCK_CATEGORY),
  );
  const [notes, setNotes] = useState(
    isEdit ? mode.block.notes : (mode.defaults.notes ?? ""),
  );

  const titleRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    titleRef.current?.focus();
    titleRef.current?.select();
  }, []);
  useFocusTrap(dialogRef, true);
  useRestoreFocus(true);

  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const save = async () => {
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      toast.error("Название не может быть пустым");
      return;
    }
    const startMin = parseHHMMStrict(start);
    if (startMin == null) {
      toast.error("Время в формате HH:MM");
      return;
    }
    const durRaw = parseInt(duration, 10);
    if (!Number.isFinite(durRaw) || durRaw < MIN_BLOCK_MIN) {
      toast.error(`Длительность ≥ ${MIN_BLOCK_MIN} мин`);
      return;
    }
    const dayIdxNum = Math.min(6, Math.max(0, parseInt(dayIdx, 10) || 0));
    const date = dateForDayIndex(weekStart, dayIdxNum);
    const { start: snappedStart, duration: snappedDur } = clampBlockToGrid(
      startMin,
      durRaw,
    );
    const status: BlockStatus = isEdit ? mode.block.status : "planned";
    const sourceEntityId = isEdit ? mode.block.source_entity_id : null;
    const draft = {
      title: trimmedTitle,
      date,
      start: minutesToTime(snappedStart),
      duration: snappedDur,
      category,
      status,
      notes,
      source_entity_id: sourceEntityId,
    };

    try {
      if (isEdit) {
        await useScheduleStore.getState().updateBlock(mode.block.id, draft);
        toast.success(`✓ Обновлён: ${trimmedTitle}`);
      } else {
        const created = await useScheduleStore.getState().addBlock(draft);
        toast.success(`✓ Создан: ${trimmedTitle}`);
        useUIStore.getState().setSelectedBlock(created.id);
      }
      onClose();
    } catch (e) {
      toast.error(`Не удалось сохранить: ${(e as Error).message}`);
    }
  };

  const remove = async () => {
    if (!isEdit) return;
    const t = mode.block.title;
    try {
      await useScheduleStore.getState().deleteBlock(mode.block.id);
      useUIStore.getState().setSelectedBlock(null);
      toast.success(`✕ Удалён: ${t}`);
      onClose();
    } catch (e) {
      toast.error(`Не удалось удалить: ${(e as Error).message}`);
    }
  };

  const onFieldEnter = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      void save();
    }
  };

  return (
    <div className="modal-bg visible" onMouseDown={onClose}>
      <div
        ref={dialogRef}
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="be-dialog-title"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="m-head">
          <span id="be-dialog-title" className="m-title">
            {isEdit ? "Редактировать" : "Новый блок"}
          </span>
          <button
            type="button"
            className="m-close"
            onClick={onClose}
            aria-label="Закрыть"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
        <div className="m-body">
          <div className="fg">
            <label className="fl" htmlFor="be-title">
              Название
            </label>
            <input
              ref={titleRef}
              id="be-title"
              className="fi"
              placeholder="Название блока..."
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={onFieldEnter}
            />
          </div>
          <div className="f-row">
            <div className="fg">
              <label className="fl" htmlFor="be-start">
                Начало
              </label>
              <input
                id="be-start"
                className="fi"
                style={{ fontFamily: "var(--mono)" }}
                value={start}
                onChange={(e) => setStart(e.target.value)}
                onKeyDown={onFieldEnter}
              />
            </div>
            <div className="fg">
              <label className="fl" htmlFor="be-dur">
                Длит. (мин)
              </label>
              <input
                id="be-dur"
                className="fi"
                style={{ fontFamily: "var(--mono)" }}
                inputMode="numeric"
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                onKeyDown={onFieldEnter}
              />
            </div>
            <div className="fg">
              <label className="fl" htmlFor="be-day">
                День
              </label>
              <input
                id="be-day"
                className="fi"
                style={{ fontFamily: "var(--mono)" }}
                inputMode="numeric"
                value={dayIdx}
                onChange={(e) => setDayIdx(e.target.value)}
                onKeyDown={onFieldEnter}
              />
            </div>
          </div>
          <div className="fg">
            <label className="fl" id="be-cat-label">
              Область
            </label>
            <div
              className="f-cats"
              role="radiogroup"
              aria-labelledby="be-cat-label"
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
                    onClick={() => setCategory(a.id)}
                  >
                    <span
                      className="cd"
                      style={{ background: a.color }}
                    />
                    {a.id}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="fg">
            <label className="fl" htmlFor="be-notes">
              Заметки
            </label>
            <textarea
              id="be-notes"
              className="fi"
              placeholder="..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
        </div>
        <div className="m-foot">
          {isEdit ? (
            <button type="button" className="btn-del" onClick={remove}>
              Удалить
            </button>
          ) : (
            <span />
          )}
          <button type="button" className="btn-save" onClick={save}>
            Сохранить
          </button>
        </div>
      </div>
    </div>
  );
}
