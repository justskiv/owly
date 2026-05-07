// Serial writer for horizon.json — mirrors enqueuePoolWrite /
// enqueueWeekWrite, but the file is global (one for the whole app)
// so we keep a single chain rather than a Map. Without this, rapid
// horizon mutations (a fast click sequence on multiple month chips,
// or batched agent commands) can race-write — last fsync to land
// silently overwrites the rest.

let inflight: Promise<unknown> = Promise.resolve();

export function enqueueHorizonWrite<T>(fn: () => Promise<T>): Promise<T> {
  const next = inflight.then(fn, fn);
  // Always advance the chain even on failure — without the catch,
  // one throw freezes every subsequent horizon write.
  inflight = next.catch(() => undefined);
  return next;
}

// Test-only: awaits any pending write-chain. Do not call from prod.
export async function flushHorizonQueue(): Promise<void> {
  await inflight;
}
