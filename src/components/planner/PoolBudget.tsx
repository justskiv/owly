import type { Block } from "../../schemas";
import type { PoolItemView } from "../../services/recalc-pool";
import {
  calcBudgetSegments,
  calcBudgetTotals,
} from "../../services/pool-budget";

interface Props {
  items: PoolItemView[];
  blocks: Block[];
}

export function PoolBudget({ items, blocks }: Props) {
  const totals = calcBudgetTotals(items, blocks);
  const { busyPct, poolPct, slackPct } = calcBudgetSegments(totals);
  const { busy, free, pool, slack } = totals;

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
