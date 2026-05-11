import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../components/shared/Toast", () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

vi.mock("../services/save-status", () => ({
  trackSave: async <T>(fn: () => Promise<T>) => fn(),
}));

const fs = new Map<string, string>();
const overrides: {
  write_file?: (path: string, content: string) => void | Promise<void>;
  read_file?: (path: string) => string | Promise<string>;
} = {};

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(
    async (
      cmd: string,
      args?: {
        path?: string;
        content?: string;
        from?: string;
        to?: string;
      },
    ) => {
      const a = args ?? {};
      switch (cmd) {
        case "get_data_dir":
          return "/data";
        case "file_exists":
          return fs.has(a.path ?? "");
        case "read_file": {
          if (overrides.read_file) return await overrides.read_file(a.path ?? "");
          const v = fs.get(a.path ?? "");
          if (v === undefined) throw new Error(`ENOENT: ${a.path}`);
          return v;
        }
        case "write_file":
          if (overrides.write_file)
            return await overrides.write_file(a.path ?? "", a.content ?? "");
          fs.set(a.path ?? "", a.content ?? "");
          return undefined;
        case "ensure_dir":
        case "list_files":
        case "move_file":
        case "delete_file":
          return undefined;
        default:
          return undefined;
      }
    },
  ),
}));

import { freezeClock, thawClock } from "../test/clock";
import { __resetDataDirCacheForTests } from "../services/file-io";
import { flushPoolQueue } from "../services/pool-write-queue";
import { usePoolStore } from "./pool";

const WEEK_A = "2026-w18";
const WEEK_B = "2026-w19";
const POOL_A = `/data/pool/${WEEK_A}.json`;
const POOL_B = `/data/pool/${WEEK_B}.json`;

function emptyPoolFile(week: string) {
  return JSON.stringify({ version: 1, week, items: [] });
}

const ITEM_DRAFT = {
  title: "T",
  hours: 1,
  category: "work",
  splittable: false,
  source_entity_id: null,
  source_kind: "ad-hoc" as const,
  placed: false,
};

beforeEach(async () => {
  fs.clear();
  delete overrides.write_file;
  delete overrides.read_file;
  __resetDataDirCacheForTests();
  usePoolStore.setState({
    currentWeek: WEEK_A,
    items: [],
    loading: false,
    error: null,
  });
  await flushPoolQueue();
  freezeClock();
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(async () => {
  await flushPoolQueue();
  thawClock();
  vi.restoreAllMocks();
});

describe("loadWeek", () => {
  it("creates an empty pool file when missing", async () => {
    await usePoolStore.getState().loadWeek(WEEK_A);
    expect(fs.has(POOL_A)).toBe(true);
    expect(usePoolStore.getState().items).toEqual([]);
  });

  it("loads items from an existing file", async () => {
    fs.set(
      POOL_A,
      JSON.stringify({
        version: 1,
        week: WEEK_A,
        items: [
          {
            id: "p1",
            ...ITEM_DRAFT,
            created_at: "2025-01-01T00:00:00",
            updated_at: "2025-01-01T00:00:00",
          },
        ],
      }),
    );
    await usePoolStore.getState().loadWeek(WEEK_A);
    expect(usePoolStore.getState().items).toHaveLength(1);
    expect(usePoolStore.getState().items[0].id).toBe("p1");
  });

  it("newer loadWeek wins when an older read settles last", async () => {
    fs.set(
      POOL_A,
      JSON.stringify({
        version: 1,
        week: WEEK_A,
        items: [
          {
            id: "pA",
            ...ITEM_DRAFT,
            created_at: "2025-01-01T00:00:00",
            updated_at: "2025-01-01T00:00:00",
          },
        ],
      }),
    );
    fs.set(
      POOL_B,
      JSON.stringify({
        version: 1,
        week: WEEK_B,
        items: [
          {
            id: "pB",
            ...ITEM_DRAFT,
            created_at: "2025-01-01T00:00:00",
            updated_at: "2025-01-01T00:00:00",
          },
        ],
      }),
    );
    // Inject a long delay only for the A read so B's faster read
    // settles first and bumps loadToken; the late A finish must noop.
    overrides.read_file = async (path) => {
      if (path === POOL_A) {
        await new Promise((r) => setTimeout(r, 20));
      }
      return fs.get(path) ?? "";
    };

    const a = usePoolStore.getState().loadWeek(WEEK_A);
    const b = usePoolStore.getState().loadWeek(WEEK_B);
    await Promise.all([a, b]);

    expect(usePoolStore.getState().currentWeek).toBe(WEEK_B);
    expect(usePoolStore.getState().items.map((i) => i.id)).toEqual(["pB"]);
  });
});

describe("addItem", () => {
  it("generates id + timestamps and persists into the current week's file", async () => {
    fs.set(POOL_A, emptyPoolFile(WEEK_A));
    await usePoolStore.getState().loadWeek(WEEK_A);
    const item = await usePoolStore
      .getState()
      .addItem({ ...ITEM_DRAFT });
    expect(item.id).toMatch(/^pool-/);
    expect(item.created_at).toBe(item.updated_at);
    const written = JSON.parse(fs.get(POOL_A)!);
    expect(written.items).toHaveLength(1);
    expect(written.items[0].id).toBe(item.id);
  });

  it("week is snapshotted at action time — concurrent week switch does not retarget the write", async () => {
    fs.set(POOL_A, emptyPoolFile(WEEK_A));
    await usePoolStore.getState().loadWeek(WEEK_A);
    // Fire addItem while WEEK_A is current, then flip to WEEK_B before
    // the write completes. The persist must land in pool/WEEK_A.json,
    // not pool/WEEK_B.json — otherwise items leak across weeks.
    const p = usePoolStore.getState().addItem({ ...ITEM_DRAFT, title: "leak" });
    usePoolStore.setState({ currentWeek: WEEK_B });
    await p;
    expect(fs.has(POOL_A)).toBe(true);
    expect(fs.has(POOL_B)).toBe(false);
    expect(JSON.parse(fs.get(POOL_A)!).items[0].title).toBe("leak");
  });
});

describe("updateItem / setPlaced / removeItem", () => {
  it("updateItem patches and stamps updated_at", async () => {
    fs.set(POOL_A, emptyPoolFile(WEEK_A));
    await usePoolStore.getState().loadWeek(WEEK_A);
    const item = await usePoolStore
      .getState()
      .addItem({ ...ITEM_DRAFT, title: "before" });
    await usePoolStore
      .getState()
      .updateItem(item.id, { title: "after" });
    expect(usePoolStore.getState().items[0].title).toBe("after");
    expect(JSON.parse(fs.get(POOL_A)!).items[0].title).toBe("after");
  });

  it("setPlaced flips the placed flag through updateItem", async () => {
    fs.set(POOL_A, emptyPoolFile(WEEK_A));
    await usePoolStore.getState().loadWeek(WEEK_A);
    const item = await usePoolStore.getState().addItem({ ...ITEM_DRAFT });
    await usePoolStore.getState().setPlaced(item.id, true);
    expect(usePoolStore.getState().items[0].placed).toBe(true);
    expect(JSON.parse(fs.get(POOL_A)!).items[0].placed).toBe(true);
  });

  it("removeItem filters and persists", async () => {
    fs.set(POOL_A, emptyPoolFile(WEEK_A));
    await usePoolStore.getState().loadWeek(WEEK_A);
    const item = await usePoolStore.getState().addItem({ ...ITEM_DRAFT });
    await usePoolStore.getState().removeItem(item.id);
    expect(usePoolStore.getState().items).toEqual([]);
    expect(JSON.parse(fs.get(POOL_A)!).items).toEqual([]);
  });
});

describe("concurrent writes", () => {
  it("serializes parallel addItem through the per-week queue", async () => {
    fs.set(POOL_A, emptyPoolFile(WEEK_A));
    await usePoolStore.getState().loadWeek(WEEK_A);
    const writes: number[] = [];
    overrides.write_file = (path, content) => {
      writes.push(
        (JSON.parse(content) as { items: unknown[] }).items.length,
      );
      fs.set(path, content);
    };
    const a = usePoolStore.getState().addItem({ ...ITEM_DRAFT, title: "A" });
    const b = usePoolStore.getState().addItem({ ...ITEM_DRAFT, title: "B" });
    await Promise.all([a, b]);
    // First persist has 1 item, second has 2 — serialization holds.
    expect(writes).toEqual([1, 2]);
  });
});
