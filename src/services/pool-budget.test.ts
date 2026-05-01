import { describe, expect, it } from "vitest";
import type { Block } from "../schemas";
import type { PoolItemView } from "./recalc-pool";
import { END_HOUR, START_HOUR } from "./time-utils";

// Mirror of the formula in components/planner/PoolBudget.tsx.
// Replicated here so tests pin the math without importing the React
// component (which would pull in the whole render tree).
const TOTAL_HOURS = (END_HOUR - START_HOUR) * 7;

function calc(items: PoolItemView[], blocks: Block[]) {
  const busy = blocks.reduce((s, b) => s + b.duration, 0) / 60;
  const free = TOTAL_HOURS - busy;
  const pool = items.reduce((s, pi) => {
    if (pi.splittable) return s + Math.max(0, pi.hours - pi.scheduled);
    return pi.placed ? s : s + pi.hours;
  }, 0);
  const slack = free - pool;
  return { busy, free, pool, slack };
}

const baseBlock: Omit<Block, "id" | "duration"> = {
  title: "blk",
  date: "2026-05-04",
  start: "09:00",
  category: "work",
  source_entity_id: null,
  pool_item_id: null,
  status: "planned",
  notes: "",
};

const baseItem: Omit<PoolItemView, "id" | "title" | "splittable" | "hours"> = {
  category: "work",
  source_entity_id: null,
  source_kind: "ad-hoc",
  placed: false,
  scheduled: 0,
  created_at: "",
  updated_at: "",
};

describe("pool budget", () => {
  it("yields TOTAL hours when nothing scheduled and nothing in pool", () => {
    const out = calc([], []);
    expect(out.busy).toBe(0);
    expect(out.free).toBe(TOTAL_HOURS);
    expect(out.pool).toBe(0);
    expect(out.slack).toBe(TOTAL_HOURS);
  });

  it("counts blocks toward busy", () => {
    const out = calc([], [
      { ...baseBlock, id: "b1", duration: 120 } as Block,
      { ...baseBlock, id: "b2", duration: 60 } as Block,
    ]);
    expect(out.busy).toBe(3);
    expect(out.free).toBe(TOTAL_HOURS - 3);
  });

  it("splittable hours - scheduled contributes to pool", () => {
    const items: PoolItemView[] = [
      {
        ...baseItem,
        id: "p1",
        title: "p1",
        splittable: true,
        hours: 12,
        scheduled: 4.5,
      } as PoolItemView,
    ];
    const out = calc(items, []);
    expect(out.pool).toBe(7.5);
  });

  it("placed atomics contribute zero", () => {
    const items: PoolItemView[] = [
      {
        ...baseItem,
        id: "p4",
        title: "p4",
        splittable: false,
        hours: 1.5,
        placed: true,
      } as PoolItemView,
    ];
    expect(calc(items, []).pool).toBe(0);
  });

  it("unplaced atomics count their full hours", () => {
    const items: PoolItemView[] = [
      {
        ...baseItem,
        id: "p5",
        title: "p5",
        splittable: false,
        hours: 0.5,
        placed: false,
      } as PoolItemView,
    ];
    expect(calc(items, []).pool).toBe(0.5);
  });

  it("slack goes negative when pool > free", () => {
    const items: PoolItemView[] = [
      {
        ...baseItem,
        id: "p1",
        title: "p1",
        splittable: true,
        hours: 200,
        scheduled: 0,
      } as PoolItemView,
    ];
    const out = calc(items, []);
    expect(out.slack).toBeLessThan(0);
  });

  it("does not double-count splittable past its hours", () => {
    const items: PoolItemView[] = [
      {
        ...baseItem,
        id: "p1",
        title: "p1",
        splittable: true,
        hours: 4,
        scheduled: 6,
      } as PoolItemView,
    ];
    expect(calc(items, []).pool).toBe(0);
  });
});
