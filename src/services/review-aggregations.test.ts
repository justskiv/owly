import { describe, expect, it } from "vitest";
import type { Block, DirectionEntity, PoolItem } from "../schemas";
import { recalcPool } from "./recalc-pool";
import {
  cadencePctForDirections,
  execPctForBlocks,
  hoursByCategory,
  hoursByDay,
  poolPctForItems,
} from "./review-aggregations";

const baseBlock: Omit<Block, "id" | "title"> = {
  date: "2026-05-04",
  start: "09:00",
  duration: 60,
  category: "work",
  source_entity_id: null,
  pool_item_id: null,
  status: "planned",
  notes: "",
};

function block(overrides: Partial<Block>): Block {
  return { id: "blk", title: "block", ...baseBlock, ...overrides } as Block;
}

const baseItem: Omit<PoolItem, "id" | "title" | "splittable"> = {
  hours: 4,
  category: "work",
  source_entity_id: null,
  source_kind: "ad-hoc",
  placed: false,
  created_at: "2026-05-01T00:00:00",
  updated_at: "2026-05-01T00:00:00",
};

function splittable(id: string, hours: number): PoolItem {
  return { ...baseItem, id, title: id, splittable: true, hours } as PoolItem;
}

function atomic(id: string, hours: number): PoolItem {
  return { ...baseItem, id, title: id, splittable: false, hours } as PoolItem;
}

function direction(
  id: string,
  fields: Partial<DirectionEntity["fields"]>,
): DirectionEntity {
  return {
    id,
    title: id,
    type: "direction",
    tags: [],
    status: "active",
    priority: null,
    deadline: null,
    estimated_minutes: null,
    description: "",
    created_at: "2026-01-01T00:00:00",
    updated_at: "2026-01-01T00:00:00",
    fields: {
      target: null,
      current: null,
      progress: null,
      cadence: null,
      last_act: null,
      cadence_label: null,
      ...fields,
    },
  };
}

describe("execPctForBlocks", () => {
  it("returns 0 for empty array", () => {
    expect(execPctForBlocks([])).toBe(0);
  });

  it("returns 100 when all blocks are done", () => {
    expect(
      execPctForBlocks([
        block({ id: "1", status: "done" }),
        block({ id: "2", status: "done" }),
      ]),
    ).toBe(100);
  });

  it("rounds to nearest integer", () => {
    // 1 done out of 3 = 33.33% → 33
    expect(
      execPctForBlocks([
        block({ id: "1", status: "done" }),
        block({ id: "2", status: "planned" }),
        block({ id: "3", status: "skipped" }),
      ]),
    ).toBe(33);
  });

  it("counts only `done` (skipped/moved/planned all excluded)", () => {
    expect(
      execPctForBlocks([
        block({ id: "1", status: "done" }),
        block({ id: "2", status: "skipped" }),
        block({ id: "3", status: "moved" }),
        block({ id: "4", status: "planned" }),
      ]),
    ).toBe(25);
  });
});

describe("poolPctForItems", () => {
  it("returns 0 for empty array", () => {
    expect(poolPctForItems([])).toBe(0);
  });

  it("counts splittable as done when scheduled >= hours", () => {
    const items = recalcPool(
      [splittable("p1", 2)],
      [block({ id: "b1", pool_item_id: "p1", duration: 120 })],
    );
    expect(poolPctForItems(items)).toBe(100);
  });

  it("counts splittable as not-done when scheduled < hours", () => {
    const items = recalcPool(
      [splittable("p1", 4)],
      [block({ id: "b1", pool_item_id: "p1", duration: 60 })],
    );
    expect(poolPctForItems(items)).toBe(0);
  });

  it("counts atomic by recalc'd placed flag", () => {
    const items = recalcPool(
      [atomic("p1", 1), atomic("p2", 0.5)],
      [block({ id: "b1", pool_item_id: "p1", duration: 60 })],
    );
    // p1 gets placed=true via block link; p2 stays false → 1/2 = 50%
    expect(poolPctForItems(items)).toBe(50);
  });
});

describe("cadencePctForDirections", () => {
  const today = new Date(2026, 4, 3); // 2026-05-03

  it("returns 0 when no directions have cadence configured", () => {
    expect(
      cadencePctForDirections(
        [direction("d1", {}), direction("d2", { target: "100" })],
        today,
      ),
    ).toBe(0);
  });

  it("ignores directions with cadence but no last_act", () => {
    expect(
      cadencePctForDirections(
        [direction("d1", { cadence: 7, last_act: null })],
        today,
      ),
    ).toBe(0);
  });

  it("counts a direction as ok when daysSince <= cadence", () => {
    expect(
      cadencePctForDirections(
        [direction("d1", { cadence: 7, last_act: "2026-04-30" })],
        today,
      ),
    ).toBe(100); // 3 days since, cadence 7 → ok
  });

  it("counts a direction as missed when daysSince > cadence", () => {
    expect(
      cadencePctForDirections(
        [direction("d1", { cadence: 2, last_act: "2026-04-25" })],
        today,
      ),
    ).toBe(0); // 8 days since, cadence 2 → missed
  });

  it("rounds the ok ratio", () => {
    // 2 ok / 3 cadence = 66.67% → 67
    expect(
      cadencePctForDirections(
        [
          direction("d1", { cadence: 7, last_act: "2026-05-01" }),
          direction("d2", { cadence: 14, last_act: "2026-04-25" }),
          direction("d3", { cadence: 1, last_act: "2026-04-20" }),
        ],
        today,
      ),
    ).toBe(67);
  });
});

describe("hoursByCategory", () => {
  it("returns empty object for no blocks", () => {
    expect(hoursByCategory([])).toEqual({});
  });

  it("aggregates duration in hours per category", () => {
    expect(
      hoursByCategory([
        block({ id: "1", category: "work", duration: 120 }),
        block({ id: "2", category: "work", duration: 30 }),
        block({ id: "3", category: "health", duration: 60 }),
      ]),
    ).toEqual({ work: 2.5, health: 1 });
  });
});

describe("hoursByDay", () => {
  const days = [
    "2026-05-04", "2026-05-05", "2026-05-06", "2026-05-07",
    "2026-05-08", "2026-05-09", "2026-05-10",
  ];

  it("initialises every day to 0", () => {
    const result = hoursByDay([], days);
    expect(Object.keys(result)).toHaveLength(7);
    for (const d of days) expect(result[d]).toBe(0);
  });

  it("sums block durations per day", () => {
    expect(
      hoursByDay(
        [
          block({ id: "1", date: "2026-05-04", duration: 60 }),
          block({ id: "2", date: "2026-05-04", duration: 90 }),
          block({ id: "3", date: "2026-05-06", duration: 30 }),
        ],
        days,
      ),
    ).toMatchObject({
      "2026-05-04": 2.5,
      "2026-05-05": 0,
      "2026-05-06": 0.5,
    });
  });

  it("ignores blocks outside the supplied week", () => {
    const result = hoursByDay(
      [block({ id: "1", date: "2026-05-01", duration: 60 })],
      days,
    );
    for (const d of days) expect(result[d]).toBe(0);
  });
});
