import type { Block } from "../schemas";
import { DAY_CAPACITY_MIN, WEEK_CAPACITY_MIN, timeToMinutes } from "./time-utils";

export interface CategoryBalance {
  category: string;
  minutes: number;
}

function isCounted(b: Block): boolean {
  return b.status === "planned" || b.status === "done";
}

function aggregate(
  blocks: Block[],
  areaOrder?: readonly string[],
): CategoryBalance[] {
  const totals = new Map<string, number>();
  for (const b of blocks) {
    if (!isCounted(b)) continue;
    totals.set(b.category, (totals.get(b.category) ?? 0) + b.duration);
  }
  const result = Array.from(totals, ([category, minutes]) => ({
    category,
    minutes,
  }));
  if (!areaOrder) return result;
  const orderIdx = (cat: string) => {
    const i = areaOrder.indexOf(cat);
    return i < 0 ? Number.MAX_SAFE_INTEGER : i;
  };
  return result.sort((a, b) => orderIdx(a.category) - orderIdx(b.category));
}

export function dayBalance(
  blocks: Block[],
  date: string,
  areaOrder?: readonly string[],
): CategoryBalance[] {
  return aggregate(
    blocks.filter((b) => b.date === date),
    areaOrder,
  );
}

export function weekBalance(
  blocks: Block[],
  areaOrder?: readonly string[],
): CategoryBalance[] {
  return aggregate(blocks, areaOrder);
}

export function dayFreeMinutes(blocks: Block[], date: string): number {
  const used = dayBalance(blocks, date).reduce((s, c) => s + c.minutes, 0);
  return Math.max(0, DAY_CAPACITY_MIN - used);
}

export function weekFreeMinutes(blocks: Block[]): number {
  const used = weekBalance(blocks).reduce((s, c) => s + c.minutes, 0);
  return Math.max(0, WEEK_CAPACITY_MIN - used);
}

export function overlappingIds(blocks: Block[]): Set<string> {
  const byDate = new Map<string, Block[]>();
  for (const b of blocks) {
    const list = byDate.get(b.date);
    if (list) list.push(b);
    else byDate.set(b.date, [b]);
  }
  const result = new Set<string>();
  for (const list of byDate.values()) {
    for (let i = 0; i < list.length; i++) {
      const a = list[i];
      const aStart = timeToMinutes(a.start);
      const aEnd = aStart + a.duration;
      for (let j = i + 1; j < list.length; j++) {
        const c = list[j];
        const cStart = timeToMinutes(c.start);
        if (aStart < cStart + c.duration && cStart < aEnd) {
          result.add(a.id);
          result.add(c.id);
        }
      }
    }
  }
  return result;
}
