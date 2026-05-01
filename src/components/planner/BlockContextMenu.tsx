import { Fragment, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { Block } from "../../schemas";
import { useScheduleStore } from "../../store/schedule";
import { useUIStore } from "../../store/ui";
import { toast } from "../shared/Toast";
import {
  END_HOUR,
  minutesToTime,
  timeToMinutes,
} from "../../services/time-utils";

interface Props {
  x: number;
  y: number;
  block: Block;
  onClose: () => void;
}

type ActionKind = "toggle-done" | "dup" | "del";

interface MenuItem {
  kind: ActionKind;
  label: string;
  danger?: boolean;
}

export function BlockContextMenu({ x, y, block, onClose }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [focusIdx, setFocusIdx] = useState(0);

  const isDone = block.status === "done";
  const items: MenuItem[] = [
    {
      kind: "toggle-done",
      label: isDone ? "✓ Не готово" : "✓ Готово",
    },
    { kind: "dup", label: "Дублировать" },
    { kind: "del", label: "Удалить", danger: true },
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
        await store.setBlockStatus(block.id, isDone ? "planned" : "done");
        toast.success(isDone ? "Не готово" : "Готово ✓");
      } else if (kind === "dup") {
        const newStartMin = timeToMinutes(block.start) + block.duration;
        if (newStartMin + block.duration > END_HOUR * 60) {
          toast.error("Не помещается до конца дня");
          onClose();
          return;
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
          pool_item_id: block.pool_item_id,
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
      toast.error(`Не удалось: ${(e as Error).message}`);
    }
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setFocusIdx((i) => (i + 1) % items.length);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setFocusIdx((i) => (i - 1 + items.length) % items.length);
      } else if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        void act(items[focusIdx].kind);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusIdx, isDone]);

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
          {idx === 2 && <div className="ctx-sep" role="separator" />}
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
            {it.label}
          </button>
        </Fragment>
      ))}
    </div>
  );
}
