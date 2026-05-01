import { describe, expect, it } from "vitest";
import type { Block, PoolItem } from "../schemas";
import { recalcPool } from "./recalc-pool";

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
  return {
    id: "blk-default",
    title: "block",
    ...baseBlock,
    ...overrides,
  } as Block;
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

function splittable(id: string, hours: number, sourceEntityId?: string): PoolItem {
  return {
    ...baseItem,
    id,
    title: id,
    splittable: true,
    hours,
    source_entity_id: sourceEntityId ?? null,
    source_kind: sourceEntityId ? "project" : "ad-hoc",
  } as PoolItem;
}

function atomic(id: string, hours: number): PoolItem {
  return {
    ...baseItem,
    id,
    title: id,
    splittable: false,
    hours,
  } as PoolItem;
}

describe("recalcPool", () => {
  it("returns empty array for empty input", () => {
    expect(recalcPool([], [])).toEqual([]);
  });

  it("computes scheduled for splittable via direct pool_item_id link", () => {
    const items = [splittable("p1", 12)];
    const blocks = [
      block({ id: "b1", pool_item_id: "p1", duration: 120 }),
      block({ id: "b2", pool_item_id: "p1", duration: 90 }),
    ];
    const out = recalcPool(items, blocks);
    expect(out[0].scheduled).toBe(3.5);
    expect(out[0].splittable).toBe(true);
  });

  it("flips placed=true for atomic with at least one linked block", () => {
    const items = [atomic("p4", 0.5)];
    const blocks = [block({ id: "b1", pool_item_id: "p4", duration: 30 })];
    const out = recalcPool(items, blocks);
    expect(out[0].placed).toBe(true);
    expect(out[0].scheduled).toBe(0.5);
  });

  it("keeps placed=false for atomic without blocks", () => {
    const items = [atomic("p5", 1.5)];
    const out = recalcPool(items, []);
    expect(out[0].placed).toBe(false);
    expect(out[0].scheduled).toBe(0);
  });

  it("falls back to source_entity_id when pool_item_id is null", () => {
    const items = [splittable("p1", 4, "ent-pr1")];
    const blocks = [
      block({ id: "b1", source_entity_id: "ent-pr1", duration: 60 }),
    ];
    const out = recalcPool(items, blocks);
    expect(out[0].scheduled).toBe(1);
  });

  it("does NOT count a block whose pool_item_id matches a different pi", () => {
    // b1 is linked to p1 directly; the source_entity_id match against p2
    // should NOT also count b1 (otherwise both pis show 1ч).
    const items = [
      splittable("p1", 4, "ent-shared"),
      splittable("p2", 4, "ent-shared"),
    ];
    const blocks = [
      block({
        id: "b1",
        pool_item_id: "p1",
        source_entity_id: "ent-shared",
        duration: 60,
      }),
    ];
    const out = recalcPool(items, blocks);
    expect(out[0].scheduled).toBe(1);
    expect(out[1].scheduled).toBe(0);
  });

  it("ignores blocks unrelated to any pool item", () => {
    const items = [splittable("p1", 4)];
    const blocks = [
      block({ id: "b1", source_entity_id: "ent-other", duration: 60 }),
    ];
    const out = recalcPool(items, blocks);
    expect(out[0].scheduled).toBe(0);
  });
});
