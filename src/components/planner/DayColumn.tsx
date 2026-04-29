import type { PointerEvent as ReactPointerEvent } from "react";
import type { Block } from "../../schemas";
import { SNAP_MIN, START_HOUR, END_HOUR, timeToMinutes } from "../../services/time-utils";
import { useEntityStore } from "../../store/entities";
import { useUIStore } from "../../store/ui";
import { InlineCreate } from "./InlineCreate";
import { NowLine } from "./NowLine";
import { SnapPreview } from "./SnapPreview";
import { TimeBlock } from "./TimeBlock";
import type { WeekActions, WeekDayModel } from "./WeekGrid";

// Phase 2 ships an EntityPopup skeleton; only the three v2 types
// (task/project/direction) will receive proper popup content in
// phases 3–5. Blocks linked to other entity kinds (events, contacts,
// goals, etc.) keep the legacy BlockEditor flow so users do not lose
// their edit path mid-rollout.
const POPUP_ENABLED_TYPES = new Set(["task", "project", "direction"]);

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

interface DropPreview {
  minute: number;
  duration: number;
}

interface DayColumnProps {
  day: WeekDayModel;
  dayIdx: number;
  selectedId: string | null;
  overlapping: Set<string>;
  actions: WeekActions;
  dropPreview: DropPreview | null;
  draggingBlockId: string | null;
  resizingBlockId: string | null;
  resizeDuration: number | null;
  onBlockPointerDown: (e: ReactPointerEvent<HTMLDivElement>, block: Block) => void;
}

export function DayColumn({
  day,
  dayIdx,
  selectedId,
  overlapping,
  actions,
  dropPreview,
  draggingBlockId,
  resizingBlockId,
  resizeDuration,
  onBlockPointerDown,
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
            dragging={draggingBlockId === b.id}
            resizeDuration={
              resizingBlockId === b.id ? resizeDuration : null
            }
            onPointerDown={onBlockPointerDown}
            onDblClick={(rect) => {
              const entityId = b.source_entity_id;
              if (entityId) {
                const entity = useEntityStore
                  .getState()
                  .entities.find((e) => e.id === entityId);
                if (entity && POPUP_ENABLED_TYPES.has(entity.type)) {
                  useUIStore
                    .getState()
                    .openEntityPopup(
                      entityId,
                      { type: "rect", rect },
                      "right",
                    );
                  return;
                }
              }
              actions.onBlockDblClick(b.id);
            }}
            onContext={(e) => actions.onBlockContext(e, b.id)}
          />
        );
      })}
      {day.isToday && day.nowMinutes != null && (
        <NowLine minutes={day.nowMinutes} />
      )}
      {dropPreview ? (
        <SnapPreview
          minute={dropPreview.minute}
          duration={dropPreview.duration}
        />
      ) : null}
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
