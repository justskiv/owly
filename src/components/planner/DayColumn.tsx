import type { MouseEvent } from "react";
import type { Block } from "../../schemas";
import {
  END_HOUR,
  SNAP_MIN,
  START_HOUR,
  timeToMinutes,
} from "../../services/time-utils";
import { InlineCreate } from "./InlineCreate";
import { NowLine } from "./NowLine";
import { TimeBlock } from "./TimeBlock";

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

interface InlineState {
  minute: number;
}

interface DayColumnProps {
  dayIdx: number;
  blocks: Block[];
  overlapping: Set<string>;
  selectedId: string | null;
  isToday: boolean;
  nowMinutes: number | null;
  inline: InlineState | null;
  onEmptyClick: (minute: number) => void;
  onBlockClick: (id: string) => void;
  onBlockDblClick: (id: string) => void;
  onBlockContext: (e: MouseEvent, id: string) => void;
  onInlineCancel: () => void;
  onInlineSubmit: (title: string) => void;
}

export function DayColumn({
  dayIdx,
  blocks,
  overlapping,
  selectedId,
  isToday,
  nowMinutes,
  inline,
  onEmptyClick,
  onBlockClick,
  onBlockDblClick,
  onBlockContext,
  onInlineCancel,
  onInlineSubmit,
}: DayColumnProps) {
  return (
    <div className="day-col" data-day={dayIdx}>
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
            onEmptyClick(snapped);
          }}
        />
      ))}
      {blocks.map((b) => {
        const startMin = timeToMinutes(b.start);
        const isNow =
          isToday &&
          nowMinutes != null &&
          startMin <= nowMinutes &&
          nowMinutes < startMin + b.duration;
        return (
          <TimeBlock
            key={b.id}
            block={b}
            selected={selectedId === b.id}
            isNow={isNow}
            overlap={overlapping.has(b.id)}
            onClick={() => onBlockClick(b.id)}
            onDblClick={() => onBlockDblClick(b.id)}
            onContext={(e) => onBlockContext(e, b.id)}
          />
        );
      })}
      {isToday && nowMinutes != null && <NowLine minutes={nowMinutes} />}
      {inline && (
        <InlineCreate
          minute={inline.minute}
          onCancel={onInlineCancel}
          onSubmit={onInlineSubmit}
        />
      )}
    </div>
  );
}
