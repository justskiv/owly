// LEGACY — phase 6 backup, removed in phase 9
import {
  DAY_CAPACITY_MIN,
  WEEKDAYS_RU,
  fmtDur,
} from "../../services/time-utils";
import type { CategoryBalance } from "../../services/balance";

interface DayHeaderProps {
  date: string;
  dayIdx: number;
  isToday: boolean;
  balance: CategoryBalance[];
  freeMinutes: number;
}

export function DayHeader({
  date,
  dayIdx,
  isToday,
  balance,
  freeMinutes,
}: DayHeaderProps) {
  const dayNum = parseInt(date.slice(8, 10), 10);
  const used = balance.reduce((s, c) => s + c.minutes, 0);
  const totalMin = Math.max(DAY_CAPACITY_MIN, used);

  return (
    <div
      className={`dh${isToday ? " today" : ""}`}
      data-tauri-drag-region
    >
      <span className="dh-name" data-tauri-drag-region>
        {WEEKDAYS_RU[dayIdx]}
      </span>
      <span className="dh-date" data-tauri-drag-region>
        {isToday ? (
          <>
            <span data-tauri-drag-region>{dayNum}</span>
            <span className="sr-only"> сегодня</span>
          </>
        ) : (
          dayNum
        )}
      </span>
      <div className="dh-bal" data-tauri-drag-region>
        <div className="dh-bar" data-tauri-drag-region>
          {balance.map((b) => (
            <span
              key={b.category}
              className="bseg"
              style={{
                width: `${(b.minutes / totalMin) * 100}%`,
                background: `var(--${b.category})`,
              }}
              data-tauri-drag-region
            />
          ))}
        </div>
        <span className="bfree" data-tauri-drag-region>
          {fmtDur(freeMinutes)}
        </span>
      </div>
    </div>
  );
}
