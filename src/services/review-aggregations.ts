import type {
  Block,
  DirectionEntity,
  PoolItem,
} from "../schemas";
import { PoolFileSchema } from "../schemas";
import { fileExists, getDataPath, readJsonFile } from "./file-io";
import { recalcPool, type PoolItemView } from "./recalc-pool";
import { daysSince } from "./urgency";
import { getCachedWeek } from "./week-cache";

export interface WeekBundle {
  blocks: Block[];
  pool: PoolItemView[];
}

// Schedule has its own week-cache (used by routine-stats too); pool
// has none. We mirror the cache pattern locally so flipping between
// Месяц/Год tabs doesn't re-stat 4 or 52 files every time. `null`
// means "verified missing", same convention as week-cache.
const poolCache = new Map<string, PoolItem[] | null>();

async function readPoolFile(weekId: string): Promise<PoolItem[] | null> {
  if (poolCache.has(weekId)) return poolCache.get(weekId) ?? null;
  const path = await getDataPath("pool", `${weekId}.json`);
  if (!(await fileExists(path))) {
    poolCache.set(weekId, null);
    return null;
  }
  try {
    const file = await readJsonFile(path, PoolFileSchema);
    poolCache.set(weekId, file.items);
    return file.items;
  } catch (e) {
    console.warn(
      `[review-aggregations] skip pool ${weekId}: ${(e as Error).message}`,
    );
    poolCache.set(weekId, null);
    return null;
  }
}

// Convenience for testing — never called in production code paths.
export function _resetPoolCacheForTest(): void {
  poolCache.clear();
}

export async function loadWeekBundle(
  weekId: string,
): Promise<WeekBundle | null> {
  const [week, pool] = await Promise.all([
    getCachedWeek(weekId),
    readPoolFile(weekId),
  ]);
  if (!week && !pool) return null;
  const blocks = week?.blocks ?? [];
  const items = pool ?? [];
  return { blocks, pool: recalcPool(items, blocks) };
}

export function execPctForBlocks(blocks: readonly Block[]): number {
  if (blocks.length === 0) return 0;
  const done = blocks.filter((b) => b.status === "done").length;
  return Math.round((done / blocks.length) * 100);
}

export function poolPctForItems(
  items: readonly PoolItemView[],
): number {
  if (items.length === 0) return 0;
  const done = items.filter((pi) =>
    pi.splittable ? pi.scheduled >= pi.hours : pi.placed,
  ).length;
  return Math.round((done / items.length) * 100);
}

export function cadencePctForDirections(
  dirs: readonly DirectionEntity[],
  today: Date,
): number {
  const cadDirs = dirs.filter(
    (d) => d.fields.cadence != null && d.fields.last_act != null,
  );
  if (cadDirs.length === 0) return 0;
  const ok = cadDirs.filter((d) => {
    const since = daysSince(d.fields.last_act, today);
    return since !== null && since <= (d.fields.cadence as number);
  }).length;
  return Math.round((ok / cadDirs.length) * 100);
}

export function hoursByCategory(
  blocks: readonly Block[],
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const b of blocks) {
    out[b.category] = (out[b.category] ?? 0) + b.duration / 60;
  }
  return out;
}

// `weekDays` carries the seven ISO dates Mon..Sun for the week we're
// rendering — passed in (not derived) so callers can reuse the same
// list they already computed for the chart label row, and so the
// helper stays pure & tz-agnostic.
export function hoursByDay(
  blocks: readonly Block[],
  weekDays: readonly string[],
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const day of weekDays) out[day] = 0;
  for (const b of blocks) {
    if (out[b.date] !== undefined) out[b.date] += b.duration / 60;
  }
  return out;
}
