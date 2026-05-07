// Per-week serial writer for pool/<week>.json — mirrors the schedule
// store's enqueueWeekWrite. Without it, two pool mutations targeting
// the same week (rapid toggle, batch agent commands) can read the
// same file, mutate, and race-write — losing whichever mutation lands
// last to the slower fsync. The schedule store has used this pattern
// since pre-phase-6; phase-6 ai-review caught the gap on the pool side.

const inflight = new Map<string, Promise<unknown>>();

export function enqueuePoolWrite<T>(
  weekId: string,
  fn: () => Promise<T>,
): Promise<T> {
  const prev = inflight.get(weekId) ?? Promise.resolve();
  const next = prev.then(fn, fn);
  // Always advance the chain even on failure — without `catch`, one
  // throw would freeze every subsequent write for that week.
  const settled = next.catch(() => undefined);
  inflight.set(weekId, settled);
  void settled.finally(() => {
    if (inflight.get(weekId) === settled) inflight.delete(weekId);
  });
  return next;
}

// Test-only: awaits any pending writes for every week. Do not call
// from prod.
export async function flushPoolQueue(): Promise<void> {
  await Promise.all(Array.from(inflight.values()));
}
