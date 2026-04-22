import { WEEK_CAPACITY_MIN, fmtDur } from "../../services/time-utils";
import type { CategoryBalance } from "../../services/balance";

interface WeekSummaryProps {
  balance: CategoryBalance[];
  freeMinutes: number;
}

export function WeekSummary({ balance, freeMinutes }: WeekSummaryProps) {
  const used = balance.reduce((s, c) => s + c.minutes, 0);
  const denom = Math.max(WEEK_CAPACITY_MIN, used);
  return (
    <div className="wsummary">
      <div className="wsbar">
        {balance.map(({ category, minutes }) => (
          <span
            key={category}
            style={{
              width: `${(minutes / denom) * 100}%`,
              background: `var(--${category})`,
            }}
          />
        ))}
      </div>
      <div className="wstats">
        {balance.map(({ category, minutes }) => (
          <div key={category} className="wst">
            <span
              className="wdot"
              style={{ background: `var(--${category})` }}
            />
            {fmtDur(minutes)}
          </div>
        ))}
        <div className="wst" style={{ opacity: 0.4 }}>
          free {fmtDur(freeMinutes)}
        </div>
      </div>
    </div>
  );
}
