import type { Block } from "../../schemas";
import type { PoolItemView } from "../../services/recalc-pool";
import { END_HOUR, START_HOUR } from "../../services/time-utils";

interface Props {
  items: PoolItemView[];
  blocks: Block[];
}

const TOTAL_HOURS = (END_HOUR - START_HOUR) * 7;

export function PoolBudget({ items, blocks }: Props) {
  const busy = blocks.reduce((s, b) => s + b.duration, 0) / 60;
  const free = TOTAL_HOURS - busy;
  const pool = items.reduce((s, pi) => {
    if (pi.splittable) return s + Math.max(0, pi.hours - pi.scheduled);
    return pi.placed ? s : s + pi.hours;
  }, 0);
  const slack = free - pool;

  // Clamp segments so the three-segment bar never overflows or
  // double-counts. busy first (always ≤100%), then pool fills the
  // remainder, slack what's left of the bar (negative slack = pool
  // pushed past available, no green segment).
  const busyPct = Math.min(100, (busy / TOTAL_HOURS) * 100);
  const poolPct = Math.max(
    0,
    Math.min(100 - busyPct, (pool / TOTAL_HOURS) * 100),
  );
  const slackPct = Math.max(0, 100 - busyPct - poolPct);

  return (
    <div className="pool-budget">
      <div className="b-row b-busy">
        <span>Занято</span>
        <span>{busy.toFixed(1)} ч</span>
      </div>
      <div className="b-row b-free">
        <span>Свободно</span>
        <span>{free.toFixed(1)} ч</span>
      </div>
      <div className="b-row b-pool indented">
        <span>
          <span className="dot dot-accent" /> Пул
        </span>
        <span className="b-pool-val">{pool.toFixed(1)} ч</span>
      </div>
      <div className="b-row b-slack indented">
        <span>
          <span
            className={"dot " + (slack >= 0 ? "dot-success" : "dot-error")}
          />{" "}
          Люфт
        </span>
        <span className={slack >= 0 ? "ok" : "err"}>
          {slack.toFixed(1)} ч
        </span>
      </div>
      <div className="b-progress">
        <div className="seg busy" style={{ width: busyPct + "%" }} />
        <div className="seg pool" style={{ width: poolPct + "%" }} />
        <div className="seg slack" style={{ width: slackPct + "%" }} />
      </div>
    </div>
  );
}
