// Per-week serial writer. enqueueWeekWrite("2026-w16", fn) chains fn
// behind any in-flight write to the same week. Two batches of
// addBlock() targeting the same week file complete in submission
// order, with no interleaving on disk. Map entries are GC'd when
// the chain settles.
//
// Why we need this: pre phase-6 the schedule store fired persistWeek
// fire-and-forget; rapid mutations let two persists race for the
// same file and the slower one would clobber the newer one. The
// agent (batch commands, hot import) makes this routine, not edge.

const inflight = new Map<string, Promise<unknown>>();

export function enqueueWeekWrite<T>(
  weekId: string,
  fn: () => Promise<T>,
): Promise<T> {
  const prev = inflight.get(weekId) ?? Promise.resolve();
  const next = prev.then(fn, fn);
  // Always advance the chain even on failure — without `catch`,
  // one throw would freeze every subsequent write for that week.
  const settled = next.catch(() => undefined);
  inflight.set(weekId, settled);
  void settled.finally(() => {
    if (inflight.get(weekId) === settled) inflight.delete(weekId);
  });
  return next;
}

// Test-only: awaits any pending writes for every week. Do not call
// from prod.
export async function flushWeekQueue(): Promise<void> {
  await Promise.all(Array.from(inflight.values()));
}
