import type { PoolFile, PoolItem } from "../schemas";
import { PoolFileSchema } from "../schemas";
import {
  getDataPath,
  readJsonFileOrCreate,
  writeJsonFile,
} from "./file-io";
import { trackSave } from "./save-status";
import { useScheduleStore, applyToWeek } from "../store/schedule";
import { usePoolStore } from "../store/pool";

// Validates and writes a pool file. Mirrors the inline `persistPool`
// in pool.ts but exposed for cross-week mutations that bypass the
// store.
async function persistPoolFile(
  week: string,
  items: PoolItem[],
): Promise<void> {
  const path = await getDataPath("pool", `${week}.json`);
  const file: PoolFile = { version: 1, week, items };
  const parsed = PoolFileSchema.safeParse(file);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`)
      .join("; ");
    throw new Error(`pool/${week}.json save rejected: ${issues}`);
  }
  await writeJsonFile(path, parsed.data);
}

// Mutate any pool week's items. Routes through the store when the
// target week is currently loaded so the UI updates reactively;
// otherwise reads the file from disk, applies the mutator, writes
// back. Mirrors `applyToWeek` in schedule.ts:244.
export async function applyToPoolWeek(
  week: string,
  mutate: (items: PoolItem[]) => PoolItem[],
): Promise<void> {
  const pool = usePoolStore.getState();
  if (week === pool.currentWeek) {
    const next = mutate(pool.items);
    usePoolStore.setState({ items: next });
    await trackSave(() => persistPoolFile(week, next));
    return;
  }
  const path = await getDataPath("pool", `${week}.json`);
  const empty: PoolFile = { version: 1, week, items: [] };
  const file = await readJsonFileOrCreate(path, PoolFileSchema, empty);
  const next = mutate(file.items);
  await trackSave(() => persistPoolFile(week, next));
}

// Removes a pool item AND every block linked to it. Used by the
// PoolSidebar's "×" button and by the `delete_pool_item` command.
// Blocks are matched by direct `pool_item_id` link only — entity-
// linked blocks belong to the entity, not the pool item, and are
// left alone.
export async function removePoolItemAndBlocks(
  poolItemId: string,
): Promise<void> {
  const blocks = useScheduleStore.getState().blocks;
  const linked = blocks.filter((b) => b.pool_item_id === poolItemId);
  for (const b of linked) {
    await useScheduleStore.getState().deleteBlock(b.id);
  }
  await usePoolStore.getState().removeItem(poolItemId);
}

// Cascade-delete a pool item from a specific week. For the current
// week, also deletes linked blocks (in the active store). For other
// weeks, deletes only the pool item — orphan blocks remain (acceptable
// per phase 6 §D12; agent can sweep later).
export async function deletePoolItemCascade(
  week: string,
  poolItemId: string,
): Promise<void> {
  const pool = usePoolStore.getState();
  if (week === pool.currentWeek) {
    await removePoolItemAndBlocks(poolItemId);
    return;
  }
  // Off-current-week: drop the pool item only. Linked blocks (if any)
  // stay in their week file as orphans.
  await applyToPoolWeek(week, (items) =>
    items.filter((it) => it.id !== poolItemId),
  );
  // Best-effort: also drop any direct-link blocks in the same week.
  // Requires the schedule applyToWeek helper.
  await applyToWeek(week, (blocks) =>
    blocks.filter((b) => b.pool_item_id !== poolItemId),
  );
}
