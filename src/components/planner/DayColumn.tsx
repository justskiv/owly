import type { MouseEvent, PointerEvent as ReactPointerEvent } from "react";
import type { Block } from "../../schemas";
import {
  END_HOUR,
  GRID_H,
  ROW_H,
  START_HOUR,
} from "../../services/time-utils";
import { DayHeader } from "./DayHeader";
import { TimeBlock } from "./TimeBlock";
import { DropIndicator } from "./DropIndicator";
import { NowLine } from "./NowLine";

interface DropTarget {
  date: string;
  minute: number;
  duration: number;
}

interface Props {
  date: string;
  dayIdx: number;
  isToday: boolean;
  blocks: Block[];
  selectedId: string | null;
  draggingId: string | null;
  resizingId: string | null;
  resizeDuration: number | null;
  dropTarget: DropTarget | null;
  nowMinutes: number | null;
  onBlockPointerDown: (
    e: ReactPointerEvent<HTMLDivElement>,
    block: Block,
  ) => void;
  onBlockDoubleClick: (block: Block, rect: DOMRect) => void;
  onBlockContextMenu: (e: MouseEvent, block: Block) => void;
}

const ROW_COUNT = (END_HOUR - START_HOUR) * 2;

export function DayColumn({
  date,
  dayIdx,
  isToday,
  blocks,
  selectedId,
  draggingId,
  resizingId,
  resizeDuration,
  dropTarget,
  nowMinutes,
  onBlockPointerDown,
  onBlockDoubleClick,
  onBlockContextMenu,
}: Props) {
  return (
    <div className="day-col-wrap">
      <DayHeader date={date} dayIdx={dayIdx} isToday={isToday} />
      <div
        className="day-body"
        style={{ height: GRID_H }}
        data-day={dayIdx}
        data-date={date}
      >
        {Array.from({ length: ROW_COUNT }, (_, i) => (
          <div
            key={i}
            className="hour-line"
            style={{ top: i * ROW_H }}
          />
        ))}
        {blocks.map((b) => (
          <TimeBlock
            key={b.id}
            block={b}
            selected={selectedId === b.id}
            dragging={draggingId === b.id}
            resizeDuration={resizingId === b.id ? resizeDuration : null}
            onPointerDown={onBlockPointerDown}
            onDoubleClick={onBlockDoubleClick}
            onContextMenu={onBlockContextMenu}
          />
        ))}
        {dropTarget?.date === date && (
          <DropIndicator minute={dropTarget.minute} />
        )}
        {isToday && nowMinutes !== null && <NowLine minutes={nowMinutes} />}
      </div>
    </div>
  );
}
