import { useEffect, useRef } from "react";
import type { MouseEvent, PointerEvent as ReactPointerEvent } from "react";
import type { Block } from "../../schemas";
import { END_HOUR, ROW_H, START_HOUR } from "../../services/time-utils";
import type { CategoryBalance } from "../../services/balance";
import { DayColumn } from "./DayColumn";
import { DayHeader } from "./DayHeader";

const HOURS = Array.from(
  { length: END_HOUR - START_HOUR + 1 },
  (_, i) => START_HOUR + i,
);

function TimeColumn() {
  return (
    <div className="time-col" data-tauri-drag-region>
      {HOURS.map((h) => (
        <div key={h} className="time-lbl" data-tauri-drag-region>
          {String(h).padStart(2, "0")}
        </div>
      ))}
    </div>
  );
}

export interface WeekDayModel {
  date: string;
  isToday: boolean;
  blocks: Block[];
  balance: CategoryBalance[];
  free: number;
  inline: { minute: number } | null;
  nowMinutes: number | null;
}

export interface WeekModel {
  weekKey: string;
  days: WeekDayModel[];
  selectedId: string | null;
  overlapping: Set<string>;
  todayIdx: number;
}

export interface WeekActions {
  onEmptyClick: (date: string, minute: number) => void;
  onBlockDblClick: (id: string) => void;
  onBlockContext: (e: MouseEvent, id: string) => void;
  onInlineCancel: () => void;
  onInlineSubmit: (date: string, minute: number, title: string) => void;
}

export interface DropTarget {
  date: string;
  minute: number;
  duration: number;
}

interface WeekGridProps {
  model: WeekModel;
  actions: WeekActions;
  dropTarget: DropTarget | null;
  draggingBlockId: string | null;
  resizingBlockId: string | null;
  resizeDuration: number | null;
  onBlockPointerDown: (e: ReactPointerEvent<HTMLDivElement>, block: Block) => void;
}

export function WeekGrid({
  model,
  actions,
  dropTarget,
  draggingBlockId,
  resizingBlockId,
  resizeDuration,
  onBlockPointerDown,
}: WeekGridProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = ROW_H * 2;
    }
  }, [model.weekKey]);

  return (
    <div className="planner-body">
      <div className="grid-area">
        <div className="day-headers">
          <div style={{ width: "var(--time-w)" }} />
          {model.days.map((day, idx) => (
            <DayHeader
              key={day.date}
              date={day.date}
              dayIdx={idx}
              isToday={day.isToday}
              balance={day.balance}
              freeMinutes={day.free}
            />
          ))}
        </div>
        <div className="grid-scroll" ref={scrollRef}>
          <div className="grid-body">
            <TimeColumn />
            {model.days.map((day, idx) => (
              <DayColumn
                key={day.date}
                day={day}
                dayIdx={idx}
                selectedId={model.selectedId}
                overlapping={model.overlapping}
                actions={actions}
                dropPreview={
                  dropTarget?.date === day.date
                    ? {
                        minute: dropTarget.minute,
                        duration: dropTarget.duration,
                      }
                    : null
                }
                draggingBlockId={draggingBlockId}
                resizingBlockId={resizingBlockId}
                resizeDuration={resizeDuration}
                onBlockPointerDown={onBlockPointerDown}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
