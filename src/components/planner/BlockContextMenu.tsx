import { useEffect, useLayoutEffect, useRef } from "react";
import type { Area, Block } from "../../schemas";
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

export function BlockContextMenu({
  x,
  y,
  block,
  areas,
  onEdit,
  onClose,
}: BlockContextMenuProps) {
  const ref = useRef<HTMLDivElement>(null);

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

  const act = async (kind: "done" | "skip" | "edit" | "dup" | "del") => {
    const store = useScheduleStore.getState();
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
    } else if (kind === "edit") {
      onEdit();
      return;
    }
    onClose();
  };

  const setCat = async (catId: string) => {
    if (catId === block.category) {
      onClose();
      return;
    }
    await useScheduleStore.getState().updateBlock(block.id, {
      category: catId,
    });
    toast.success(`Категория: ${catId}`);
    onClose();
  };

  return (
    <div
      ref={ref}
      className="ctx visible"
      style={{ visibility: "hidden" }}
      role="menu"
      onContextMenu={(e) => e.preventDefault()}
    >
      <div className="ctx-i" onClick={() => void act("done")}>
        <span style={{ color: "var(--success)" }}>✓</span>Выполнено
        <span className="ctx-sc">D</span>
      </div>
      <div className="ctx-i" onClick={() => void act("skip")}>
        <span style={{ color: "var(--text-tertiary)" }}>✗</span>Пропущено
        <span className="ctx-sc">S</span>
      </div>
      <div className="ctx-sep" />
      <div className="ctx-i" onClick={() => void act("edit")}>
        Редактировать<span className="ctx-sc">Enter</span>
      </div>
      <div className="ctx-i" onClick={() => void act("dup")}>
        Дублировать
      </div>
      <div className="ctx-i danger" onClick={() => void act("del")}>
        Удалить<span className="ctx-sc">⌫</span>
      </div>
      <div className="ctx-sep" />
      <div className="ctx-cols">
        {areas.map((a) => (
          <span
            key={a.id}
            className={`ctx-c${block.category === a.id ? " active" : ""}`}
            style={{ background: a.color }}
            onClick={() => void setCat(a.id)}
          />
        ))}
      </div>
    </div>
  );
}
