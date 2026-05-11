import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../components/shared/Toast", () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

vi.mock("./save-status", () => ({
  trackSave: async <T>(fn: () => Promise<T>) => fn(),
}));

vi.mock("./review-aggregations", () => ({
  invalidatePoolCache: vi.fn(),
}));

const fs = new Map<string, string>();

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(
    async (
      cmd: string,
      args?: {
        path?: string;
        content?: string;
        from?: string;
        to?: string;
        dir?: string;
      },
    ) => {
      const a = args ?? {};
      switch (cmd) {
        case "get_data_dir":
          return "/data";
        case "file_exists":
          return fs.has(a.path ?? "");
        case "read_file": {
          const v = fs.get(a.path ?? "");
          if (v === undefined) throw new Error(`ENOENT: ${a.path}`);
          return v;
        }
        case "write_file":
          fs.set(a.path ?? "", a.content ?? "");
          return undefined;
        case "move_file": {
          const v = fs.get(a.from ?? "");
          if (v === undefined) throw new Error(`ENOENT: ${a.from}`);
          fs.set(a.to ?? "", v);
          fs.delete(a.from ?? "");
          return undefined;
        }
        case "delete_file":
          fs.delete(a.path ?? "");
          return undefined;
        case "ensure_dir":
        case "list_files":
          return [];
        default:
          return undefined;
      }
    },
  ),
}));

import type { Block, PoolItem } from "../schemas";
import { freezeClock, thawClock } from "../test/clock";
import { __resetDataDirCacheForTests } from "./file-io";
import { clearWeekCache } from "./week-cache";
import { flushPoolQueue } from "./pool-write-queue";
import { flushWeekQueue } from "./week-write-queue";
import { useScheduleStore } from "../store/schedule";
import { usePoolStore } from "../store/pool";
import {
  applyToPoolWeek,
  deletePoolItemCascade,
  removePoolItemAndBlocks,
} from "./pool-actions";

const WEEK_A = "2026-w18";
const WEEK_B = "2026-w19";
const POOL_PATH_A = `/data/pool/${WEEK_A}.json`;
const POOL_PATH_B = `/data/pool/${WEEK_B}.json`;
const SCHED_PATH_A = `/data/schedule/${WEEK_A}.json`;
const SCHED_PATH_B = `/data/schedule/${WEEK_B}.json`;

function poolItem(opts: Partial<PoolItem> & { id: string }): PoolItem {
  return {
    id: opts.id,
    title: opts.title ?? "T",
    hours: opts.hours ?? 1,
    category: opts.category ?? "work",
    splittable: opts.splittable ?? false,
    source_entity_id: opts.source_entity_id ?? null,
    source_kind: opts.source_kind ?? "ad-hoc",
    placed: opts.placed ?? false,
    created_at: opts.created_at ?? "2025-01-01T00:00:00",
    updated_at: opts.updated_at ?? "2025-01-01T00:00:00",
  };
}

function block(opts: Partial<Block> & { id: string }): Block {
  return {
    id: opts.id,
    title: opts.title ?? "B",
    date: opts.date ?? "2026-04-27",
    start: opts.start ?? "10:00",
    duration: opts.duration ?? 60,
    category: opts.category ?? "work",
    source_entity_id: opts.source_entity_id ?? null,
    pool_item_id: opts.pool_item_id ?? null,
    status: opts.status ?? "planned",
    notes: opts.notes ?? "",
  };
}

function plantPoolFile(week: string, items: PoolItem[]): void {
  const path = week === WEEK_A ? POOL_PATH_A : POOL_PATH_B;
  fs.set(path, JSON.stringify({ version: 1, week, items }));
}

function plantWeekFile(week: string, blocks: Block[]): void {
  const path = week === WEEK_A ? SCHED_PATH_A : SCHED_PATH_B;
  const startDate = week === WEEK_A ? "2026-04-27" : "2026-05-04";
  fs.set(
    path,
    JSON.stringify({
      version: 1,
      week,
      start_date: startDate,
      template_applied: null,
      blocks,
    }),
  );
}

beforeEach(async () => {
  fs.clear();
  __resetDataDirCacheForTests();
  clearWeekCache();
  usePoolStore.setState({
    currentWeek: WEEK_A,
    items: [],
    loading: false,
    error: null,
  });
  useScheduleStore.setState({
    currentWeek: WEEK_A,
    startDate: "2026-04-27",
    templateApplied: null,
    blocks: [],
    loading: false,
    error: null,
  });
  await flushPoolQueue();
  await flushWeekQueue();
  freezeClock();
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(async () => {
  await flushPoolQueue();
  await flushWeekQueue();
  thawClock();
  vi.restoreAllMocks();
});

describe("applyToPoolWeek", () => {
  it("routes through the store when targeting the current pool week", async () => {
    plantPoolFile(WEEK_A, []);
    await usePoolStore.getState().loadWeek(WEEK_A);
    await applyToPoolWeek(WEEK_A, (items) => items.concat(poolItem({ id: "p1" })));
    expect(usePoolStore.getState().items.map((i) => i.id)).toEqual(["p1"]);
    const persisted = JSON.parse(fs.get(POOL_PATH_A)!) as {
      items: PoolItem[];
    };
    expect(persisted.items[0].id).toBe("p1");
  });

  it("read-modify-writes an off-current pool week without touching the store", async () => {
    plantPoolFile(WEEK_A, [poolItem({ id: "stay" })]);
    await usePoolStore.getState().loadWeek(WEEK_A);
    plantPoolFile(WEEK_B, [poolItem({ id: "old" })]);
    await applyToPoolWeek(WEEK_B, (items) =>
      items.concat(poolItem({ id: "added" })),
    );
    // Current week unaffected — `applyToPoolWeek` mutates disk only.
    expect(usePoolStore.getState().items.map((i) => i.id)).toEqual(["stay"]);
    const persisted = JSON.parse(fs.get(POOL_PATH_B)!) as {
      items: PoolItem[];
    };
    expect(persisted.items.map((i) => i.id)).toEqual(["old", "added"]);
  });

  it("creates the off-current pool file on the fly when missing", async () => {
    await usePoolStore.getState().loadWeek(WEEK_A);
    // No WEEK_B pool file planted — readJsonFileOrCreate produces an
    // empty file, mutator appends one item, persist lands on disk.
    await applyToPoolWeek(WEEK_B, (items) =>
      items.concat(poolItem({ id: "fresh" })),
    );
    expect(fs.has(POOL_PATH_B)).toBe(true);
    expect(
      (JSON.parse(fs.get(POOL_PATH_B)!) as { items: PoolItem[] }).items[0].id,
    ).toBe("fresh");
  });
});

describe("removePoolItemAndBlocks", () => {
  it("deletes the pool item plus every block directly linked via pool_item_id", async () => {
    plantPoolFile(WEEK_A, [
      poolItem({ id: "p1" }),
      poolItem({ id: "p2" }),
    ]);
    plantWeekFile(WEEK_A, [
      block({ id: "b1", pool_item_id: "p1" }),
      block({ id: "b2", pool_item_id: null, source_entity_id: "ent-x" }),
      block({ id: "b3", pool_item_id: "p2" }),
    ]);
    await usePoolStore.getState().loadWeek(WEEK_A);
    await useScheduleStore.getState().loadWeek(WEEK_A);

    await removePoolItemAndBlocks("p1");

    // Linked block gone, entity-linked block untouched.
    expect(
      useScheduleStore.getState().blocks.map((b) => b.id).sort(),
    ).toEqual(["b2", "b3"]);
    expect(
      usePoolStore.getState().items.map((i) => i.id),
    ).toEqual(["p2"]);
  });
});

describe("deletePoolItemCascade", () => {
  it("on the current week, removes the pool item and its direct-link blocks", async () => {
    plantPoolFile(WEEK_A, [poolItem({ id: "p1" })]);
    plantWeekFile(WEEK_A, [
      block({ id: "b1", pool_item_id: "p1" }),
      block({ id: "b2", pool_item_id: null }),
    ]);
    await usePoolStore.getState().loadWeek(WEEK_A);
    await useScheduleStore.getState().loadWeek(WEEK_A);

    await deletePoolItemCascade(WEEK_A, "p1");

    expect(usePoolStore.getState().items).toEqual([]);
    expect(
      useScheduleStore.getState().blocks.map((b) => b.id),
    ).toEqual(["b2"]);
  });

  it("on an off-current week, drops the pool item AND the same-week direct-link blocks (best-effort)", async () => {
    // Current week is WEEK_A (loaded), the cascade target is WEEK_B.
    // Per the phase-6 D12 contract, off-current cascades clear pool
    // items and best-effort drop direct-link blocks in that week —
    // orphan blocks in other weeks are left for an agent sweep.
    plantPoolFile(WEEK_A, []);
    plantPoolFile(WEEK_B, [poolItem({ id: "px" })]);
    plantWeekFile(WEEK_B, [
      block({ id: "b1", pool_item_id: "px" }),
      block({ id: "b2", pool_item_id: null }),
    ]);
    await usePoolStore.getState().loadWeek(WEEK_A);

    await deletePoolItemCascade(WEEK_B, "px");

    const pool = JSON.parse(fs.get(POOL_PATH_B)!) as { items: PoolItem[] };
    expect(pool.items).toEqual([]);
    const week = JSON.parse(fs.get(SCHED_PATH_B)!) as { blocks: Block[] };
    expect(week.blocks.map((b) => b.id)).toEqual(["b2"]);
  });
});
