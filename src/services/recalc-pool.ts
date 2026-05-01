import type { Block, PoolItem } from "../schemas";

// In-memory derived shape. recalcPool augments PoolItem with the
// `scheduled` value computed from the current week's blocks. This
// field is NEVER persisted — `usePoolStore.items` keeps the canonical
// PoolItem (with the persisted `placed` flag for atomics, no
// `scheduled`). Spec §4.6 / phase 6 §11.
export type PoolItemView = PoolItem & { scheduled: number };

// Each block is counted exactly once. Direct match via pool_item_id
// wins. If a block has pool_item_id set but it's not this pi's id,
// we skip — the block belongs to another pool item. Otherwise fall
// back to source_entity_id matching (legacy / drag-from-tasks where
// the block ended up linked to an entity but no pool item).
export function recalcPool(
  poolItems: readonly PoolItem[],
  blocks: readonly Block[],
): PoolItemView[] {
  return poolItems.map((pi) => {
    const linked = blocks.filter((b) => {
      if (b.pool_item_id === pi.id) return true;
      if (b.pool_item_id !== null) return false;
      return (
        pi.source_entity_id !== null &&
        b.source_entity_id === pi.source_entity_id
      );
    });
    const scheduled = linked.reduce((s, b) => s + b.duration, 0) / 60;
    if (pi.splittable) {
      return { ...pi, scheduled };
    }
    return { ...pi, scheduled, placed: linked.length > 0 };
  });
}
