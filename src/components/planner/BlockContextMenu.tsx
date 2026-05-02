import { Fragment, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { Block } from "../../schemas";
import { useScheduleStore } from "../../store/schedule";
import { usePoolStore } from "../../store/pool";
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
      toast.error(`Не удалось: ${(e as Error).message}`);
    }
  };

  // Keep the latest `act` and `items` accessible to the static
  // keydown listener below without re-attaching it on every render.
  // Without this, the listener captured the first render's `block`
  // prop and would dispatch actions against a stale block if the
  // parent updated it (and the previous deps array silently skipped
  // those re-attaches via an eslint-disable). Refs sidestep both.
  const actRef = useRef(act);
  const itemsRef = useRef(items);
  actRef.current = act;
  itemsRef.current = items;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const handled =
        e.key === "ArrowDown" ||
        e.key === "ArrowUp" ||
        e.key === "Enter" ||
        e.key === " " ||
        e.key === "Delete" ||
        e.key === "Backspace";
      if (!handled) return;
      // Stop propagation so the planner-level Delete handler doesn't
      // also run on a block while the context menu is open.
      e.preventDefault();
      e.stopImmediatePropagation();
      const list = itemsRef.current;
      if (e.key === "ArrowDown") {
        setFocusIdx((i) => (i + 1) % list.length);
      } else if (e.key === "ArrowUp") {
        setFocusIdx((i) => (i - 1 + list.length) % list.length);
      } else if (e.key === "Enter" || e.key === " ") {
        setFocusIdx((curIdx) => {
          void actRef.current(list[curIdx].kind);
          return curIdx;
        });
      } else if (e.key === "Delete" || e.key === "Backspace") {
        void actRef.current("del");
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
