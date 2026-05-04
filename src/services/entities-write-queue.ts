// Serial writer for entities.json — mirrors enqueueHorizonWrite.
// entities.json is global (one for the whole app), so we keep a single
// chain rather than a per-key Map. Without this, a rapid burst of
// agent commands (batched create_entity / update_entity) plus a
// concurrent UI mutation can race-write — last fsync to land
// silently overwrites the rest, even though every individual
// snapshot is a valid superset of the others.

let inflight: Promise<unknown> = Promise.resolve();

export function enqueueEntitiesWrite<T>(fn: () => Promise<T>): Promise<T> {
  const next = inflight.then(fn, fn);
  // Always advance the chain even on failure — without the catch,
  // one throw freezes every subsequent entities write.
  inflight = next.catch(() => undefined);
  return next;
}
