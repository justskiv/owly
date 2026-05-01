// LEGACY — phase 6 backup, removed in phase 9
import { Fragment, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import type { Area, Block } from "../../schemas";
import { useRestoreFocus } from "../../hooks/useRestoreFocus";
import { useScheduleStore } from "../../store/schedule";
import { useUIStore } from "../../store/ui";
import { toast } from "../shared/Toast";
import {
  clampBlockToGrid,
  minutesToTime,
  timeToMinutes,
} from "../../services/time-utils";

interface BlockContextMenuProps {
  x: number;
  y: number;
  block: Block;
  areas: Area[];
  onEdit: () => void;
  onClose: () => void;
}

type ActionKind = "done" | "skip" | "edit" | "dup" | "del";

interface MenuItemDef {
  kind: ActionKind;
  label: string;
  shortcut?: string;
  leading?: ReactNode;
  danger?: boolean;
}

const ITEMS: MenuItemDef[] = [
  {
    kind: "done",
    label: "Выполнено",
    shortcut: "D",
    leading: <span style={{ color: "var(--success)" }}>✓</span>,
  },
  {
    kind: "skip",
    label: "Пропущено",
    shortcut: "S",
    leading: <span style={{ color: "var(--text-tertiary)" }}>✗</span>,
  },
  { kind: "edit", label: "Редактировать", shortcut: "Enter" },
  { kind: "dup", label: "Дублировать" },
  { kind: "del", label: "Удалить", shortcut: "⌫", danger: true },
];

// Indices of separators inside the items list (between kind groups).
// Trailing separator before colour swatches is rendered separately.
const SEPARATORS_AFTER = new Set([1]);

export function BlockContextMenu({
  x,
  y,
  block,
  areas,
  onEdit,
  onClose,
}: BlockContextMenuProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [focusIdx, setFocusIdx] = useState(0);

  // Restore focus to whatever owned it before the menu opened.
  useRestoreFocus(true);

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
    // Focus the menu container itself so it receives keydown events;
    // the active item is highlighted visually via class instead of
    // moving DOM focus around (more robust against pointer events
    // before/after open).
    el.focus({ preventScroll: true });
  }, [x, y]);

  // Outside-click closes (owned-by-component per CODESTYLE p.8).
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
    if (kind === "edit") {
      onEdit();
      return;
    }
    const store = useScheduleStore.getState();
    try {
      if (kind === "done") {
        await store.setBlockStatus(block.id, "done");
        toast.success("Done ✓");
      } else if (kind === "skip") {
        await store.setBlockStatus(block.id, "skipped");
        toast.success("Skipped");
      } else if (kind === "del") {
        const t = block.title;
        await store.deleteBlock(block.id);
        useUIStore.getState().setSelectedBlock(null);
        toast.success(`✕ Удалён: ${t}`);
      } else if (kind === "dup") {
        const newStartMin = timeToMinutes(block.start) + block.duration;
        const { start: clampedStart, duration: clampedDur } = clampBlockToGrid(
          newStartMin,
          block.duration,
        );
        const created = await store.addBlock({
          title: block.title,
          date: block.date,
          start: minutesToTime(clampedStart),
          duration: clampedDur,
          category: block.category,
          status: "planned",
          notes: block.notes,
          source_entity_id: block.source_entity_id,
        });
        useUIStore.getState().setSelectedBlock(created.id);
        toast.success(`⧉ Дублирован: ${block.title}`);
      }
      onClose();
    } catch (e) {
      toast.error(`Не удалось: ${(e as Error).message}`);
    }
  };

  const setCat = async (catId: string) => {
    if (catId === block.category) {
      onClose();
      return;
    }
    try {
      await useScheduleStore.getState().updateBlock(block.id, {
        category: catId,
      });
      toast.success(`Категория: ${catId}`);
      onClose();
    } catch (e) {
      toast.error(`Не удалось: ${(e as Error).message}`);
    }
  };

  // Global keydown while menu is open — focus may not be inside the
  // menu after pointer-driven open, so a window listener is more
  // reliable than React onKeyDown.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setFocusIdx((i) => (i + 1) % ITEMS.length);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setFocusIdx((i) => (i - 1 + ITEMS.length) % ITEMS.length);
      } else if (e.key === "Home") {
        e.preventDefault();
        setFocusIdx(0);
      } else if (e.key === "End") {
        e.preventDefault();
        setFocusIdx(ITEMS.length - 1);
      } else if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        void act(ITEMS[focusIdx].kind);
      }
      // Esc is handled by the planner-level hotkey (overlay close).
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // act/onClose closures need fresh focusIdx
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusIdx]);

  return (
    <div
      ref={ref}
      className="ctx visible"
      style={{ visibility: "hidden" }}
      role="menu"
      aria-label="Действия над блоком"
      tabIndex={-1}
      onContextMenu={(e) => e.preventDefault()}
    >
      {ITEMS.map((it, idx) => (
        <Fragment key={it.kind}>
          <button
            type="button"
            role="menuitem"
            tabIndex={-1}
            className={`ctx-i${it.danger ? " danger" : ""}${
              idx === focusIdx ? " focused" : ""
            }`}
            onClick={() => void act(it.kind)}
            onMouseEnter={() => setFocusIdx(idx)}
          >
            {it.leading}
            {it.label}
            {it.shortcut ? <span className="ctx-sc">{it.shortcut}</span> : null}
          </button>
          {SEPARATORS_AFTER.has(idx) ? (
            <div className="ctx-sep" role="separator" />
          ) : null}
        </Fragment>
      ))}
      <div className="ctx-sep" role="separator" />
      <div className="ctx-cols" role="group" aria-label="Категория">
        {areas.map((a) => (
          <button
            key={a.id}
            type="button"
            role="menuitemradio"
            aria-checked={block.category === a.id}
            aria-label={a.label}
            tabIndex={-1}
            className={`ctx-c${block.category === a.id ? " active" : ""}`}
            style={{ background: a.color }}
            onClick={() => void setCat(a.id)}
          />
        ))}
      </div>
    </div>
  );
}
