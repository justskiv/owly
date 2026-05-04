import { Fragment, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import type { Block, BlockStatus } from "../../schemas";
import { useScheduleStore } from "../../store/schedule";
import { usePoolStore } from "../../store/pool";
import { useUIStore } from "../../store/ui";
import { useConfigStore } from "../../store/config";
import { toast } from "../shared/Toast";
import {
  END_HOUR,
  minutesToTime,
  timeToMinutes,
} from "../../services/time-utils";
import { errMsg } from "../../services/format";

interface Props {
  x: number;
  y: number;
  block: Block;
  onClose: () => void;
}

type ActionKind =
  | "toggle-done"
  | "toggle-skipped"
  | "edit"
  | "dup"
  | "del";

interface MenuItem {
  kind: ActionKind;
  label: string;
  icon?: ReactNode;
  shortcut?: string;
  danger?: boolean;
}

// Indices that get a separator drawn AFTER them. Indices are into the
// `items` list below; separators sit between status toggles and the
// edit/dup/del group, and between dup and del to mark the danger zone.
const SEP_AFTER: ReadonlySet<number> = new Set([1, 3]);

export function BlockContextMenu({ x, y, block, onClose }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [focusIdx, setFocusIdx] = useState(0);
  const config = useConfigStore((s) => s.config);
  const areas = config?.areas ?? [];

  const isDone = block.status === "done";
  const isSkipped = block.status === "skipped";

  const items: MenuItem[] = [
    {
      kind: "toggle-done",
      label: isDone ? "Не готово" : "Выполнено",
      icon: <span style={{ color: "var(--success)" }}>✓</span>,
      shortcut: "D",
    },
    {
      kind: "toggle-skipped",
      label: isSkipped ? "Не пропущено" : "Пропущено",
      icon: <span style={{ color: "var(--text-tertiary)" }}>✗</span>,
      shortcut: "S",
    },
    { kind: "edit", label: "Редактировать", shortcut: "Enter" },
    { kind: "dup", label: "Дублировать" },
    { kind: "del", label: "Удалить", shortcut: "⌫", danger: true },
  ];

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    el.style.visibility = "hidden";
    const r = el.getBoundingClientRect();
    let left = x;
    let top = y;
    if (r.right > window.innerWidth - 4) {
      left = Math.max(4, window.innerWidth - r.width - 4);
    }
    if (r.bottom > window.innerHeight - 4) {
      top = Math.max(4, window.innerHeight - r.height - 4);
    }
    el.style.left = `${left}px`;
    el.style.top = `${top}px`;
    el.style.visibility = "visible";
    el.focus({ preventScroll: true });
  }, [x, y]);

  useEffect(() => {
    const onDoc = (e: Event) => {
      const target = e.target as Node | null;
      if (ref.current && target && ref.current.contains(target)) return;
      onClose();
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [onClose]);

  const act = async (kind: ActionKind) => {
    const store = useScheduleStore.getState();
    try {
      if (kind === "toggle-done") {
        const next: BlockStatus = isDone ? "planned" : "done";
        await store.setBlockStatus(block.id, next);
        toast.success(isDone ? "Не готово" : "Готово ✓");
      } else if (kind === "toggle-skipped") {
        const next: BlockStatus = isSkipped ? "planned" : "skipped";
        await store.setBlockStatus(block.id, next);
        toast.success(isSkipped ? "Не пропущено" : "Пропущено ✗");
      } else if (kind === "edit") {
        const el = document.querySelector<HTMLElement>(
          `[data-block-id="${block.id}"]`,
        );
        if (el) {
          const rect = el.getBoundingClientRect();
          useUIStore
            .getState()
            .openBlockPopup(block.id, { type: "rect", rect }, "right");
        }
      } else if (kind === "dup") {
        const newStartMin = timeToMinutes(block.start) + block.duration;
        if (newStartMin + block.duration > END_HOUR * 60) {
          toast.error("Не помещается до конца дня");
          onClose();
          return;
        }
        // For blocks linked to an ATOMIC pool item, do NOT carry the
        // pool_item_id over — atomic items are "placed once" and a
        // second linked block would silently double-count, breaking
        // the placed-flag and budget. Splittable links carry through
        // (their `scheduled` simply grows by the duplicate's hours).
        let dupPoolItemId = block.pool_item_id;
        if (dupPoolItemId !== null) {
          const pi = usePoolStore
            .getState()
            .items.find((x) => x.id === dupPoolItemId);
          if (pi && !pi.splittable) dupPoolItemId = null;
        }
        const created = await store.addBlock({
          title: block.title,
          date: block.date,
          start: minutesToTime(newStartMin),
          duration: block.duration,
          category: block.category,
          status: "planned",
          notes: block.notes,
          source_entity_id: block.source_entity_id,
          pool_item_id: dupPoolItemId,
        });
        useUIStore.getState().setSelectedBlock(created.id);
        toast.success(`⧉ Дублирован`);
      } else if (kind === "del") {
        const t = block.title;
        await store.deleteBlock(block.id);
        useUIStore.getState().setSelectedBlock(null);
        toast.success(`Удалён: ${t}`);
      }
      onClose();
    } catch (e) {
      toast.error(`Не удалось: ${errMsg(e)}`);
    }
  };

  const setCategory = async (catId: string) => {
    if (catId === block.category) {
      onClose();
      return;
    }
    try {
      await useScheduleStore
        .getState()
        .updateBlock(block.id, { category: catId });
      const label =
        areas.find((a) => a.id === catId)?.label ?? catId;
      toast.success(`Категория: ${label}`);
      onClose();
    } catch (e) {
      toast.error(`Не удалось: ${errMsg(e)}`);
    }
  };

  // Keep the latest `act` and `items` accessible to the static keydown
  // listener without re-attaching it on every render. Without refs the
  // listener captures the first render's `block` prop and would
  // dispatch actions against a stale block if the parent updated it.
  const actRef = useRef(act);
  const itemsRef = useRef(items);
  actRef.current = act;
  itemsRef.current = items;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const k = e.key;
      const isShortcut =
        k === "ArrowDown" ||
        k === "ArrowUp" ||
        k === "Enter" ||
        k === " " ||
        k === "Delete" ||
        k === "Backspace" ||
        k === "d" ||
        k === "D" ||
        k === "s" ||
        k === "S";
      if (!isShortcut) return;
      // Stop propagation so the planner-level Delete handler doesn't
      // also fire while the context menu is open.
      e.preventDefault();
      e.stopImmediatePropagation();
      const list = itemsRef.current;
      if (k === "ArrowDown") {
        setFocusIdx((i) => (i + 1) % list.length);
      } else if (k === "ArrowUp") {
        setFocusIdx((i) => (i - 1 + list.length) % list.length);
      } else if (k === "Enter" || k === " ") {
        setFocusIdx((curIdx) => {
          void actRef.current(list[curIdx].kind);
          return curIdx;
        });
      } else if (k === "Delete" || k === "Backspace") {
        void actRef.current("del");
      } else if (k === "d" || k === "D") {
        void actRef.current("toggle-done");
      } else if (k === "s" || k === "S") {
        void actRef.current("toggle-skipped");
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, []);

  return (
    <div
      ref={ref}
      className="block-ctx"
      style={{ visibility: "hidden" }}
      role="menu"
      aria-label="Действия над блоком"
      tabIndex={-1}
      onContextMenu={(e) => e.preventDefault()}
    >
      {items.map((it, idx) => (
        <Fragment key={it.kind}>
          <button
            type="button"
            role="menuitem"
            tabIndex={-1}
            className={`ctx-item${it.danger ? " danger" : ""}${
              idx === focusIdx ? " focused" : ""
            }`}
            onClick={() => void act(it.kind)}
            onMouseEnter={() => setFocusIdx(idx)}
          >
            {it.icon ? (
              <span className="ctx-icon" aria-hidden>
                {it.icon}
              </span>
            ) : (
              <span className="ctx-icon" aria-hidden />
            )}
            <span className="ctx-label">{it.label}</span>
            {it.shortcut && <span className="ctx-sc">{it.shortcut}</span>}
          </button>
          {SEP_AFTER.has(idx) && <div className="ctx-sep" role="separator" />}
        </Fragment>
      ))}
      {areas.length > 0 && (
        <>
          <div className="ctx-sep" role="separator" />
          <div
            className="ctx-cols"
            role="radiogroup"
            aria-label="Категория"
          >
            {areas.map((a) => (
              <button
                key={a.id}
                type="button"
                role="radio"
                aria-checked={block.category === a.id}
                aria-label={a.label}
                title={a.label}
                className={`ctx-c${block.category === a.id ? " active" : ""}`}
                style={{ background: a.color }}
                onClick={() => void setCategory(a.id)}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
