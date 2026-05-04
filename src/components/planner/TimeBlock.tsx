import type { MouseEvent, PointerEvent as ReactPointerEvent } from "react";
import type { Block } from "../../schemas";
import {
  ROW_H,
  START_HOUR,
  minutesToTime,
  timeToMinutes,
} from "../../services/time-utils";

interface Props {
  block: Block;
  selected: boolean;
  dragging?: boolean;
  resizeDuration: number | null;
  onPointerDown: (
    e: ReactPointerEvent<HTMLDivElement>,
    block: Block,
  ) => void;
  onDoubleClick: (block: Block, rect: DOMRect) => void;
  onContextMenu: (e: MouseEvent, block: Block) => void;
}

export function TimeBlock({
  block,
  selected,
  dragging = false,
  resizeDuration,
  onPointerDown,
  onDoubleClick,
  onContextMenu,
}: Props) {
  const effectiveDur = resizeDuration ?? block.duration;
  const startMin = timeToMinutes(block.start);
  const top = ((startMin - START_HOUR * 60) / 30) * ROW_H;
  const height = (effectiveDur / 30) * ROW_H;
  const cls =
    "block" +
    ` cat-${block.category}` +
    ` status-${block.status}` +
    (selected ? " selected" : "") +
    (dragging ? " dragging-source" : "");

  return (
    <div
      className={cls}
      style={{ top, height }}
      onPointerDown={(e) => onPointerDown(e, block)}
      onDoubleClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onDoubleClick(block, e.currentTarget.getBoundingClientRect());
      }}
      onContextMenu={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onContextMenu(e, block);
      }}
      data-block-id={block.id}
      data-category={block.category}
      role="button"
      aria-pressed={selected}
      aria-label={`${block.title}, ${minutesToTime(startMin)}–${minutesToTime(startMin + effectiveDur)}`}
    >
      <div className="b-title">{block.title}</div>
      {height > 28 && (
        <div className="b-time">
          {minutesToTime(startMin)}–{minutesToTime(startMin + effectiveDur)}
        </div>
      )}
      <div className="resize-handle" />
    </div>
  );
}
