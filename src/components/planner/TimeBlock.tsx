import type { MouseEvent, PointerEvent as ReactPointerEvent } from "react";
import type { Block } from "../../schemas";
import {
  ROW_H,
  fmtDur,
  minToY,
  minutesToTime,
  timeToMinutes,
} from "../../services/time-utils";

interface TimeBlockProps {
  block: Block;
  selected: boolean;
  isNow: boolean;
  overlap: boolean;
  dragging: boolean;
  resizeDuration: number | null;
  onPointerDown: (e: ReactPointerEvent<HTMLDivElement>, block: Block) => void;
  onDblClick: (rect: DOMRect) => void;
  onContext: (e: MouseEvent) => void;
}

export function TimeBlock({
  block,
  selected,
  isNow,
  overlap,
  dragging,
  resizeDuration,
  onPointerDown,
  onDblClick,
  onContext,
}: TimeBlockProps) {
  const effectiveDur = resizeDuration ?? block.duration;
  const startMin = timeToMinutes(block.start);
  const endMin = startMin + effectiveDur;

  const cls = [
    "tb",
    block.category,
    selected && "selected",
    isNow && "now",
    block.status === "done" && "done",
    block.status === "skipped" && "skipped",
    overlap && "overlap",
    dragging && "dragging",
  ]
    .filter(Boolean)
    .join(" ");

  const ariaLabel =
    `${block.title}, ${minutesToTime(startMin)}–${minutesToTime(endMin)}, ` +
    `${fmtDur(effectiveDur)}, ${block.category}` +
    (block.status === "done"
      ? ", выполнено"
      : block.status === "skipped"
        ? ", пропущено"
        : "");

  return (
    <div
      className={cls}
      style={{
        top: minToY(startMin),
        height: (effectiveDur / 30) * ROW_H,
      }}
      tabIndex={-1}
      role="button"
      aria-label={ariaLabel}
      aria-pressed={selected}
      data-block-id={block.id}
      onPointerDown={(e) => onPointerDown(e, block)}
      onDoubleClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onDblClick(e.currentTarget.getBoundingClientRect());
      }}
      onContextMenu={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onContext(e);
      }}
    >
      <div className="bt">{block.title}</div>
      {effectiveDur >= 30 && (
        <div className="bm">
          {minutesToTime(startMin)}–{minutesToTime(endMin)} ·{" "}
          {fmtDur(effectiveDur)}
        </div>
      )}
      {effectiveDur >= 90 && block.notes && (
        <div className="bn">{block.notes}</div>
      )}
      <div className="rh" />
    </div>
  );
}
