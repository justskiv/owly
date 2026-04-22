import { useEffect, useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import type { Area, Block, BlockStatus } from "../../schemas";
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

type EditorMode = "new" | "edit";

export interface EditorPrefill {
  date?: string;
  start?: string;
  duration?: number;
  category?: string;
  title?: string;
  notes?: string;
}

interface BlockEditorProps {
  mode: EditorMode;
  block: Block | null;
  prefill: EditorPrefill;
  weekStart: string;
  areas: Area[];
  onClose: () => void;
}

export function BlockEditor({
  mode,
  block,
  prefill,
  weekStart,
  areas,
  onClose,
}: BlockEditorProps) {
  const isEdit = mode === "edit" && block !== null;

  const initialDayIdx = isEdit
    ? Math.max(0, dayIndexOfDate(block.date, weekStart))
    : prefill.date
      ? Math.max(0, dayIndexOfDate(prefill.date, weekStart))
      : 0;

  const [title, setTitle] = useState(
    isEdit ? block.title : (prefill.title ?? ""),
  );
  const [start, setStart] = useState(
    isEdit ? block.start : (prefill.start ?? "09:00"),
  );
  const [duration, setDuration] = useState(
    String(
      isEdit ? block.duration : (prefill.duration ?? DEFAULT_BLOCK_DURATION_MIN),
    ),
  );
  const [dayIdx, setDayIdx] = useState(String(initialDayIdx));
  const [category, setCategory] = useState(
    isEdit ? block.category : (prefill.category ?? DEFAULT_BLOCK_CATEGORY),
  );
  const [notes, setNotes] = useState(
    isEdit ? block.notes : (prefill.notes ?? ""),
  );

  const titleRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    titleRef.current?.focus();
    titleRef.current?.select();
  }, []);

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
    const draft = {
      title: trimmedTitle,
      date,
      start: minutesToTime(snappedStart),
      duration: snappedDur,
      category,
      status: (block?.status ?? "planned") as BlockStatus,
      notes,
      source_entity_id: block?.source_entity_id ?? null,
    };

    try {
      if (isEdit && block) {
        await useScheduleStore.getState().updateBlock(block.id, draft);
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
    if (!isEdit || !block) return;
    const t = block.title;
    try {
      await useScheduleStore.getState().deleteBlock(block.id);
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
      <div className="modal" onMouseDown={(e) => e.stopPropagation()}>
        <div className="m-head">
          <span className="m-title">
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
