import type { MouseEvent } from "react";
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
  onClick: () => void;
  onDblClick: () => void;
  onContext: (e: MouseEvent) => void;
}

export function TimeBlock({
  block,
  selected,
  isNow,
  overlap,
  onClick,
  onDblClick,
  onContext,
}: TimeBlockProps) {
  const startMin = timeToMinutes(block.start);
  const endMin = startMin + block.duration;

  const cls = [
    "tb",
    block.category,
    selected && "selected",
    isNow && "now",
    block.status === "done" && "done",
    block.status === "skipped" && "skipped",
    overlap && "overlap",
  ]
    .filter(Boolean)
    .join(" ");

  const ariaLabel =
    `${block.title}, ${minutesToTime(startMin)}–${minutesToTime(endMin)}, ` +
    `${fmtDur(block.duration)}, ${block.category}` +
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
        height: (block.duration / 30) * ROW_H,
      }}
      tabIndex={0}
      role="button"
      aria-label={ariaLabel}
      aria-pressed={selected}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      onDoubleClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onDblClick();
      }}
      onContextMenu={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onContext(e);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          e.stopPropagation();
          onDblClick();
        }
        if (e.key === " ") {
          e.preventDefault();
          e.stopPropagation();
          onClick();
        }
      }}
    >
      <div className="bt">{block.title}</div>
      {block.duration >= 30 && (
        <div className="bm">
          {minutesToTime(startMin)}–{minutesToTime(endMin)} ·{" "}
          {fmtDur(block.duration)}
        </div>
      )}
      {block.duration >= 90 && block.notes && (
        <div className="bn">{block.notes}</div>
      )}
      <div className="rh" />
    </div>
  );
}
