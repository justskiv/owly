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
    <div className="wsummary" data-tauri-drag-region>
      <div className="wsbar" data-tauri-drag-region>
        {balance.map(({ category, minutes }) => (
          <span
            key={category}
            style={{
              width: `${(minutes / denom) * 100}%`,
              background: `var(--${category})`,
            }}
            data-tauri-drag-region
          />
        ))}
      </div>
      <div className="wstats" data-tauri-drag-region>
        {balance.map(({ category, minutes }) => (
          <div key={category} className="wst" data-tauri-drag-region>
            <span
              className="wdot"
              style={{ background: `var(--${category})` }}
              data-tauri-drag-region
            />
            {fmtDur(minutes)}
          </div>
        ))}
        <div
          className="wst"
          style={{ opacity: 0.4 }}
          data-tauri-drag-region
        >
          free {fmtDur(freeMinutes)}
        </div>
      </div>
    </div>
  );
}
