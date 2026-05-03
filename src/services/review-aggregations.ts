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

// DirectionEntity narrowed to the variant where both cadence fields
// are populated. Lets call sites stop sprinkling `as number` casts.
export type DirectionWithCadence = DirectionEntity & {
  fields: DirectionEntity["fields"] & {
    cadence: number;
    last_act: string;
  };
};

export function hasCadence(d: DirectionEntity): d is DirectionWithCadence {
  return d.fields.cadence != null && d.fields.last_act != null;
}

// Mock §9.4 fixes a left-to-right area order in stacked charts and
// horizontal bars: work, growth, health, life, people. We honor that
// for the known ids and append any user-defined custom areas after,
// in their config order.
const ORDERED_AREA_IDS = ["work", "growth", "health", "life", "people"];

export function orderedAreas<T extends { id: string }>(
  areas: readonly T[],
): T[] {
  const remaining = new Map(areas.map((a) => [a.id, a]));
  const out: T[] = [];
  for (const id of ORDERED_AREA_IDS) {
    const a = remaining.get(id);
    if (a) {
      out.push(a);
      remaining.delete(id);
    }
  }
  for (const a of areas) {
    if (remaining.has(a.id)) out.push(a);
  }
  return out;
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

// Pool store / pool actions call this after every mutation so the
// next Месяц/Год read picks up fresh data. Without it the cache would
// silently serve a pre-edit snapshot until app restart.
export function invalidatePoolCache(weekId?: string): void {
  if (weekId === undefined) {
    poolCache.clear();
    return;
  }
  poolCache.delete(weekId);
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
  const cadDirs = dirs.filter(hasCadence);
  if (cadDirs.length === 0) return 0;
  const ok = cadDirs.filter((d) => {
    const since = daysSince(d.fields.last_act, today);
    return since !== null && since <= d.fields.cadence;
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
