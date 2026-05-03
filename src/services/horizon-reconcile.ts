import type { HorizonProjectState } from "../schemas";

export interface ReconcileResult {
  toAdd: string[];
  toRemove: string[];
}

// Pure: compares the set of project entity ids with the set of ids
// already tracked by horizon. Returns ids missing from horizon (to be
// added) and ids in horizon that no longer have a backing entity (to
// be removed). No mutations — caller decides what to do.
//
// Used in two places: a one-shot reconcile right after both stores
// finish loading at startup (catches up users whose data/horizon.json
// predates the seed-v2/horizon.json bundle), and a diff-based
// subscription that only ever sees newly-added/removed projects going
// forward (see App.tsx).
export function reconcile(
  entityProjectIds: ReadonlySet<string>,
  horizonProjects: readonly HorizonProjectState[],
): ReconcileResult {
  const horizonIds = new Set(horizonProjects.map((p) => p.project_id));
  const toAdd: string[] = [];
  const toRemove: string[] = [];
  for (const id of entityProjectIds) {
    if (!horizonIds.has(id)) toAdd.push(id);
  }
  for (const id of horizonIds) {
    if (!entityProjectIds.has(id)) toRemove.push(id);
  }
  return { toAdd, toRemove };
}
