import { useEffect, useMemo, useRef } from "react";
import type { MouseEvent } from "react";
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

interface DayBalance {
  date: string;
  balance: CategoryBalance[];
  free: number;
}

interface InlineState {
  date: string;
  minute: number;
}

interface WeekGridProps {
  weekKey: string;
  weekDates: string[];
  blocks: Block[];
  dayBalances: DayBalance[];
  overlapping: Set<string>;
  selectedId: string | null;
  todayIdx: number;
  nowMinutes: number | null;
  inline: InlineState | null;
  onEmptyClick: (date: string, minute: number) => void;
  onBlockClick: (id: string) => void;
  onBlockDblClick: (id: string) => void;
  onBlockContext: (e: MouseEvent, id: string) => void;
  onInlineCancel: () => void;
  onInlineSubmit: (date: string, minute: number, title: string) => void;
}

export function WeekGrid({
  weekKey,
  weekDates,
  blocks,
  dayBalances,
  overlapping,
  selectedId,
  todayIdx,
  nowMinutes,
  inline,
  onEmptyClick,
  onBlockClick,
  onBlockDblClick,
  onBlockContext,
  onInlineCancel,
  onInlineSubmit,
}: WeekGridProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const blocksByDate = useMemo(() => {
    const map = new Map<string, Block[]>();
    for (const b of blocks) {
      const list = map.get(b.date);
      if (list) list.push(b);
      else map.set(b.date, [b]);
    }
    return map;
  }, [blocks]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = ROW_H * 2;
    }
  }, [weekKey]);

  return (
    <div className="planner-body">
      <div className="grid-area">
        <div className="day-headers">
          <div style={{ width: "var(--time-w)" }} />
          {weekDates.map((date, idx) => (
            <DayHeader
              key={date}
              date={date}
              dayIdx={idx}
              isToday={todayIdx === idx}
              balance={dayBalances[idx].balance}
              freeMinutes={dayBalances[idx].free}
            />
          ))}
        </div>
        <div className="grid-scroll" ref={scrollRef}>
          <div className="grid-body">
            <TimeColumn />
            {weekDates.map((date, idx) => {
              const inlineForDay =
                inline?.date === date ? { minute: inline.minute } : null;
              return (
                <DayColumn
                  key={date}
                  dayIdx={idx}
                  blocks={blocksByDate.get(date) ?? []}
                  overlapping={overlapping}
                  selectedId={selectedId}
                  isToday={todayIdx === idx}
                  nowMinutes={todayIdx === idx ? nowMinutes : null}
                  inline={inlineForDay}
                  onEmptyClick={(min) => onEmptyClick(date, min)}
                  onBlockClick={onBlockClick}
                  onBlockDblClick={onBlockDblClick}
                  onBlockContext={onBlockContext}
                  onInlineCancel={onInlineCancel}
                  onInlineSubmit={(title) => {
                    if (inlineForDay) {
                      onInlineSubmit(date, inlineForDay.minute, title);
                    }
                  }}
                />
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
