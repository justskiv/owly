// Serial writer for config.json — mirrors enqueueHorizonWrite.
// config.json is global, so a single chain rather than a per-key Map.
// Without this, two rapid Settings mutations (e.g., setAreas followed
// by setSchedulingPrefs while typing) can race-write and lose the
// later snapshot if its fsync lands first.

let inflight: Promise<unknown> = Promise.resolve();

export function enqueueConfigWrite<T>(fn: () => Promise<T>): Promise<T> {
  const next = inflight.then(fn, fn);
  // Always advance the chain even on failure — without the catch,
  // one throw freezes every subsequent config write.
  inflight = next.catch(() => undefined);
  return next;
}

// Test-only: awaits any pending write-chain. Do not call from prod.
export async function flushConfigQueue(): Promise<void> {
  await inflight;
}
