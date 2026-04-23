import { SNAP_MIN, START_HOUR, END_HOUR, timeToMinutes } from "../../services/time-utils";
import { InlineCreate } from "./InlineCreate";
import { NowLine } from "./NowLine";
import { TimeBlock } from "./TimeBlock";
import type { WeekActions, WeekDayModel } from "./WeekGrid";

interface GridRow {
  hour: number;
  halfHour: 0 | 1;
  minute: number;
  isHm: boolean;
}

const ROWS: GridRow[] = (() => {
  const out: GridRow[] = [];
  for (let h = START_HOUR; h < END_HOUR; h++) {
    for (let hf = 0; hf <= 1; hf++) {
      out.push({
        hour: h,
        halfHour: hf as 0 | 1,
        minute: h * 60 + hf * 30,
        isHm: hf === 1,
      });
    }
  }
  return out;
})();

interface DayColumnProps {
  day: WeekDayModel;
  dayIdx: number;
  selectedId: string | null;
  overlapping: Set<string>;
  actions: WeekActions;
}

export function DayColumn({
  day,
  dayIdx,
  selectedId,
  overlapping,
  actions,
}: DayColumnProps) {
  const inline = day.inline;
  return (
    <div className="day-col" data-day={dayIdx} data-date={day.date}>
      {ROWS.map(({ hour, halfHour, minute, isHm }) => (
        <div
          key={`${hour}-${halfHour}`}
          className={`gr${isHm ? " hm" : ""}`}
          data-day={dayIdx}
          data-min={minute}
          onMouseDown={(e) => {
            if (e.button !== 0) return;
            if (e.target !== e.currentTarget) return;
            e.preventDefault();
            const snapped = Math.round(minute / SNAP_MIN) * SNAP_MIN;
            actions.onEmptyClick(day.date, snapped);
          }}
        />
      ))}
      {day.blocks.map((b) => {
        const startMin = timeToMinutes(b.start);
        const isNow =
          day.nowMinutes != null &&
          startMin <= day.nowMinutes &&
          day.nowMinutes < startMin + b.duration;
        return (
          <TimeBlock
            key={b.id}
            block={b}
            selected={selectedId === b.id}
            isNow={isNow}
            overlap={overlapping.has(b.id)}
            onClick={() => actions.onBlockClick(b.id)}
            onDblClick={() => actions.onBlockDblClick(b.id)}
            onContext={(e) => actions.onBlockContext(e, b.id)}
          />
        );
      })}
      {day.isToday && day.nowMinutes != null && (
        <NowLine minutes={day.nowMinutes} />
      )}
      {inline && (
        <InlineCreate
          minute={inline.minute}
          onCancel={actions.onInlineCancel}
          onSubmit={(title) =>
            actions.onInlineSubmit(day.date, inline.minute, title)
          }
        />
      )}
    </div>
  );
}
