import { useLayoutEffect, useRef } from "react";
import type { MouseEvent, PointerEvent as ReactPointerEvent } from "react";
import type { Block } from "../../schemas";
import { ROW_H } from "../../services/time-utils";
import { TimeGutter } from "./TimeGutter";
import { DayColumn } from "./DayColumn";

interface DropTarget {
  date: string;
  minute: number;
  duration: number;
}

interface Props {
  weekKey: string;
  weekDates: string[];
  blocksByDate: Map<string, Block[]>;
  selectedId: string | null;
  draggingId: string | null;
  resizingId: string | null;
  resizeDuration: number | null;
  dropTarget: DropTarget | null;
  todayIdx: number;
  nowMinutes: number | null;
  onBlockPointerDown: (
    e: ReactPointerEvent<HTMLDivElement>,
    block: Block,
  ) => void;
  onBlockDoubleClick: (block: Block, rect: DOMRect) => void;
  onBlockContextMenu: (e: MouseEvent, block: Block) => void;
}

export function WeekGrid({
  weekKey,
  weekDates,
  blocksByDate,
  selectedId,
  draggingId,
  resizingId,
  resizeDuration,
  dropTarget,
  todayIdx,
  nowMinutes,
  onBlockPointerDown,
  onBlockDoubleClick,
  onBlockContextMenu,
}: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Default scroll position lands at 09:00 — two hours below 07:00
  // so the morning routines stay glanceable above and working hours
  // are immediately visible. Use useLayoutEffect so the scroll
  // happens before paint; with useEffect the user briefly sees the
  // grid scrolled to the top before it jumps to 09:00.
  useLayoutEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = ROW_H * 4;
    }
  }, [weekKey]);

  return (
    <div className="grid-wrap">
      <div className="grid-scroll" ref={scrollRef}>
        <TimeGutter />
        <div className="day-cols">
          {weekDates.map((date, idx) => (
            <DayColumn
              key={date}
              date={date}
              dayIdx={idx}
              isToday={idx === todayIdx}
              blocks={blocksByDate.get(date) ?? []}
              selectedId={selectedId}
              draggingId={draggingId}
              resizingId={resizingId}
              resizeDuration={resizeDuration}
              dropTarget={dropTarget}
              nowMinutes={idx === todayIdx ? nowMinutes : null}
              onBlockPointerDown={onBlockPointerDown}
              onBlockDoubleClick={onBlockDoubleClick}
              onBlockContextMenu={onBlockContextMenu}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
