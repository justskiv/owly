import { describe, expect, it } from "vitest";
import type { Block } from "../schemas";
import type { PoolItemView } from "./recalc-pool";
import {
  TOTAL_HOURS,
  calcBudgetSegments,
  calcBudgetTotals,
} from "./pool-budget";

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

describe("calcBudgetTotals", () => {
  it("returns TOTAL hours when nothing scheduled and nothing in pool", () => {
    const out = calcBudgetTotals([], []);
    expect(out.busy).toBe(0);
    expect(out.free).toBe(TOTAL_HOURS);
    expect(out.pool).toBe(0);
    expect(out.slack).toBe(TOTAL_HOURS);
  });

  it("counts blocks toward busy", () => {
    const out = calcBudgetTotals([], [
      { ...baseBlock, id: "b1", duration: 120 } as Block,
      { ...baseBlock, id: "b2", duration: 60 } as Block,
    ]);
    expect(out.busy).toBe(3);
    expect(out.free).toBe(TOTAL_HOURS - 3);
  });

  it("splittable hours minus scheduled contributes to pool", () => {
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
    expect(calcBudgetTotals(items, []).pool).toBe(7.5);
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
    expect(calcBudgetTotals(items, []).pool).toBe(0);
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
    expect(calcBudgetTotals(items, []).pool).toBe(0.5);
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
    expect(calcBudgetTotals(items, []).slack).toBeLessThan(0);
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
    expect(calcBudgetTotals(items, []).pool).toBe(0);
  });
});

describe("calcBudgetSegments", () => {
  it("zero everywhere for empty totals", () => {
    const seg = calcBudgetSegments({ busy: 0, free: TOTAL_HOURS, pool: 0, slack: TOTAL_HOURS });
    expect(seg.busyPct).toBe(0);
    expect(seg.poolPct).toBe(0);
    expect(seg.slackPct).toBe(100);
  });

  it("clamps slack to 0 when pool exceeds free", () => {
    const seg = calcBudgetSegments({
      busy: 50,
      free: TOTAL_HOURS - 50,
      pool: 200,
      slack: -150,
    });
    expect(seg.slackPct).toBe(0);
    expect(seg.busyPct + seg.poolPct).toBeLessThanOrEqual(100);
  });

  it("never overflows past 100%", () => {
    const seg = calcBudgetSegments({
      busy: 200,
      free: -88,
      pool: 50,
      slack: -138,
    });
    expect(seg.busyPct).toBe(100);
    expect(seg.poolPct).toBe(0);
    expect(seg.slackPct).toBe(0);
  });
});
