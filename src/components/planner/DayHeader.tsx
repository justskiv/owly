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
    <div className={`dh${isToday ? " today" : ""}`}>
      <span className="dh-name">{WEEKDAYS_RU[dayIdx]}</span>
      <span className="dh-date">
        {isToday ? (
          <>
            <span>{dayNum}</span>
            <span className="sr-only"> сегодня</span>
          </>
        ) : (
          dayNum
        )}
      </span>
      <div className="dh-bal">
        <div className="dh-bar">
          {balance.map((b) => (
            <span
              key={b.category}
              className="bseg"
              style={{
                width: `${(b.minutes / totalMin) * 100}%`,
                background: `var(--${b.category})`,
              }}
            />
          ))}
        </div>
        <span className="bfree">{fmtDur(freeMinutes)}</span>
      </div>
    </div>
  );
}
