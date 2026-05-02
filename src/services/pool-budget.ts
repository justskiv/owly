import type { Block } from "../schemas";
import type { PoolItemView } from "./recalc-pool";
import { END_HOUR, START_HOUR } from "./time-utils";

// Single source of truth for the pool-budget arithmetic. Both the
// PoolBudget React component and pool-budget.test.ts import this so
// the test pins the formula the UI actually uses (extracting was
// flagged by the phase-6 ai-review — duplicated formula in the test
// could silently drift from the component).

export const TOTAL_HOURS = (END_HOUR - START_HOUR) * 7;

export interface BudgetTotals {
  busy: number;
  free: number;
  pool: number;
  slack: number;
}

export interface BudgetSegments {
  busyPct: number;
  poolPct: number;
  slackPct: number;
}

export function calcBudgetTotals(
  items: readonly PoolItemView[],
  blocks: readonly Block[],
): BudgetTotals {
  const busy = blocks.reduce((s, b) => s + b.duration, 0) / 60;
  const free = TOTAL_HOURS - busy;
  const pool = items.reduce((s, pi) => {
    if (pi.splittable) return s + Math.max(0, pi.hours - pi.scheduled);
    return pi.placed ? s : s + pi.hours;
  }, 0);
  const slack = free - pool;
  return { busy, free, pool, slack };
}

// Three-segment progress bar widths in percent. Clamped so the row
// never overflows: busy ≤ 100, pool ≤ 100-busy, slack absorbs the
// remainder. Negative slack collapses to zero — a red "Люфт" number
// already signals over-commit; the bar shouldn't try to display it.
export function calcBudgetSegments(totals: BudgetTotals): BudgetSegments {
  const busyPct = Math.min(100, (totals.busy / TOTAL_HOURS) * 100);
  const poolPct = Math.max(
    0,
    Math.min(100 - busyPct, (totals.pool / TOTAL_HOURS) * 100),
  );
  const slackPct = Math.max(0, 100 - busyPct - poolPct);
  return { busyPct, poolPct, slackPct };
}
