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
  list_files?: (dir: string) => string[] | Promise<string[]>;
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
        case "list_files": {
          if (overrides.list_files) return await overrides.list_files(a.dir ?? "");
          const dir = (a.dir ?? "").endsWith("/") ? (a.dir ?? "") : `${a.dir ?? ""}/`;
          const names: string[] = [];
          for (const k of fs.keys()) {
            if (k.startsWith(dir) && !k.slice(dir.length).includes("/")) {
              names.push(k.slice(dir.length));
            }
          }
          return names;
        }
        case "ensure_dir":
          return undefined;
        default:
          return undefined;
      }
    },
  ),
}));

import type { Block } from "../schemas";
import { freezeClock, thawClock } from "../test/clock";
import { __resetDataDirCacheForTests } from "../services/file-io";
import { clearWeekCache, getCachedWeek } from "../services/week-cache";
import { flushWeekQueue } from "../services/week-write-queue";
import {
  applyToWeek,
  findBlockById,
  findWeekContainingBlock,
  useScheduleStore,
} from "./schedule";
import { useUIStore } from "./ui";

const WEEK_A = "2026-w18";
const WEEK_B = "2026-w19";
const WEEK_PATH_A = `/data/schedule/${WEEK_A}.json`;
const WEEK_PATH_B = `/data/schedule/${WEEK_B}.json`;

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

function weekFile(week: string, blocks: Block[]): string {
  return JSON.stringify({
    version: 1,
    week,
    start_date: week === WEEK_A ? "2026-04-27" : "2026-05-04",
    template_applied: null,
    blocks,
  });
}

beforeEach(async () => {
  fs.clear();
  delete overrides.write_file;
  delete overrides.read_file;
  delete overrides.list_files;
  __resetDataDirCacheForTests();
  clearWeekCache();
  useScheduleStore.setState({
    currentWeek: WEEK_A,
    startDate: "2026-04-27",
    templateApplied: null,
    blocks: [],
    loading: false,
    error: null,
  });
  useUIStore.setState({ weekPromptId: null });
  await flushWeekQueue();
  freezeClock();
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(async () => {
  await flushWeekQueue();
  thawClock();
  vi.restoreAllMocks();
});

describe("loadWeek", () => {
  it("loads an existing week file into state", async () => {
    fs.set(WEEK_PATH_A, weekFile(WEEK_A, [block({ id: "b1" })]));
    await useScheduleStore.getState().loadWeek(WEEK_A);
    expect(useScheduleStore.getState().blocks).toHaveLength(1);
    expect(useScheduleStore.getState().blocks[0].id).toBe("b1");
    expect(useScheduleStore.getState().currentWeek).toBe(WEEK_A);
  });

  it("missing week + silentCreate=false raises the weekPrompt and skips file creation", async () => {
    await useScheduleStore.getState().loadWeek(WEEK_A);
    expect(useUIStore.getState().weekPromptId).toBe(WEEK_A);
    expect(useScheduleStore.getState().blocks).toEqual([]);
    // PlannerPage owns the create — the store must not write a file
    // here, otherwise the user is robbed of the template/empty choice.
    expect(fs.has(WEEK_PATH_A)).toBe(false);
  });

  it("missing week + silentCreate=true creates an empty file via the recovery path", async () => {
    await useScheduleStore.getState().loadWeek(WEEK_A, { silentCreate: true });
    expect(fs.has(WEEK_PATH_A)).toBe(true);
    expect(useScheduleStore.getState().blocks).toEqual([]);
  });

  it("clears a stale weekPrompt when a different existing week loads cleanly", async () => {
    useUIStore.setState({ weekPromptId: "2026-w15" });
    fs.set(WEEK_PATH_A, weekFile(WEEK_A, []));
    await useScheduleStore.getState().loadWeek(WEEK_A);
    expect(useUIStore.getState().weekPromptId).toBeNull();
  });

  it("newer loadWeek wins when an older read settles last", async () => {
    fs.set(WEEK_PATH_A, weekFile(WEEK_A, [block({ id: "pA" })]));
    fs.set(WEEK_PATH_B, weekFile(WEEK_B, [block({ id: "pB" })]));
    // Delay A's read so B's faster read commits first and bumps
    // loadToken — A's late finish must bail at the token check.
    overrides.read_file = async (path) => {
      if (path === WEEK_PATH_A) {
        await new Promise((r) => setTimeout(r, 20));
      }
      return fs.get(path) ?? "";
    };
    const a = useScheduleStore.getState().loadWeek(WEEK_A);
    const b = useScheduleStore.getState().loadWeek(WEEK_B);
    await Promise.all([a, b]);
    expect(useScheduleStore.getState().currentWeek).toBe(WEEK_B);
    expect(useScheduleStore.getState().blocks.map((bb) => bb.id)).toEqual([
      "pB",
    ]);
  });
});

describe("addBlock / updateBlock / deleteBlock", () => {
  beforeEach(async () => {
    fs.set(WEEK_PATH_A, weekFile(WEEK_A, []));
    await useScheduleStore.getState().loadWeek(WEEK_A);
  });

  it("addBlock generates id, appends, persists, and seeds the cache early", async () => {
    const result = await useScheduleStore.getState().addBlock({
      title: "New",
      date: "2026-04-28",
      start: "09:00",
      duration: 60,
      category: "work",
      source_entity_id: null,
      status: "planned",
      notes: "",
    });
    expect(result.id).toMatch(/^blk-/);
    expect(useScheduleStore.getState().blocks).toHaveLength(1);
    const persisted = JSON.parse(fs.get(WEEK_PATH_A)!) as {
      blocks: Block[];
    };
    expect(persisted.blocks[0].id).toBe(result.id);
    // syncCache must seed the freshly mutated week into the cache so
    // stats consumers reading via getCachedWeek see the new block
    // synchronously, BEFORE the persist round-trip lands.
    const cached = await getCachedWeek(WEEK_A);
    expect(cached?.blocks.map((bb) => bb.id)).toContain(result.id);
  });

  it("updateBlock patches one block and persists", async () => {
    const b = await useScheduleStore.getState().addBlock(block({ id: "b1" }));
    await useScheduleStore.getState().updateBlock(b.id, { title: "renamed" });
    expect(useScheduleStore.getState().blocks[0].title).toBe("renamed");
    const persisted = JSON.parse(fs.get(WEEK_PATH_A)!) as {
      blocks: Block[];
    };
    expect(persisted.blocks[0].title).toBe("renamed");
  });

  it("moveBlock / resizeBlock / setBlockStatus delegate to updateBlock", async () => {
    const b = await useScheduleStore.getState().addBlock(block({ id: "b1" }));
    await useScheduleStore.getState().moveBlock(b.id, "2026-04-29", "11:00");
    await useScheduleStore.getState().resizeBlock(b.id, 90);
    await useScheduleStore.getState().setBlockStatus(b.id, "done");
    const after = useScheduleStore.getState().blocks[0];
    expect(after.date).toBe("2026-04-29");
    expect(after.start).toBe("11:00");
    expect(after.duration).toBe(90);
    expect(after.status).toBe("done");
  });

  it("deleteBlock filters and persists", async () => {
    const b = await useScheduleStore.getState().addBlock(block({ id: "b1" }));
    await useScheduleStore.getState().deleteBlock(b.id);
    expect(useScheduleStore.getState().blocks).toEqual([]);
    expect(
      (JSON.parse(fs.get(WEEK_PATH_A)!) as { blocks: Block[] }).blocks,
    ).toEqual([]);
  });
});

describe("saveWeek", () => {
  it("persists the current snapshot through the per-week queue", async () => {
    useScheduleStore.setState({
      currentWeek: WEEK_A,
      startDate: "2026-04-27",
      templateApplied: "default",
      blocks: [block({ id: "b1" })],
    });
    await useScheduleStore.getState().saveWeek();
    const persisted = JSON.parse(fs.get(WEEK_PATH_A)!) as {
      template_applied: string | null;
      blocks: Block[];
    };
    expect(persisted.template_applied).toBe("default");
    expect(persisted.blocks[0].id).toBe("b1");
  });
});

describe("goToNextWeek / goToPrevWeek / goToCurrentWeek", () => {
  it("goToNextWeek loads addWeeks(currentWeek, +1)", async () => {
    useScheduleStore.setState({ currentWeek: WEEK_A });
    fs.set(WEEK_PATH_B, weekFile(WEEK_B, []));
    await useScheduleStore.getState().goToNextWeek();
    expect(useScheduleStore.getState().currentWeek).toBe(WEEK_B);
  });

  it("goToPrevWeek loads addWeeks(currentWeek, -1)", async () => {
    useScheduleStore.setState({ currentWeek: WEEK_B });
    fs.set(WEEK_PATH_A, weekFile(WEEK_A, []));
    await useScheduleStore.getState().goToPrevWeek();
    expect(useScheduleStore.getState().currentWeek).toBe(WEEK_A);
  });

  it("goToCurrentWeek loads the week derived from now() via freezeClock", async () => {
    // freezeClock pins now() to 2025-06-11T10:00:00Z — that maps to a
    // specific ISO week id. We don't care which one exactly; we just
    // want loadWeek to be called with whatever getCurrentWeekId
    // returns, and the prompt to come up when that file is missing.
    await useScheduleStore.getState().goToCurrentWeek();
    expect(useUIStore.getState().weekPromptId).not.toBeNull();
  });
});

describe("persist failure", () => {
  it("keeps optimistic in-memory mutation when WeekFileSchema rejects", async () => {
    fs.set(WEEK_PATH_A, weekFile(WEEK_A, []));
    await useScheduleStore.getState().loadWeek(WEEK_A);
    // Inject an invalid duration into addBlock — Zod's BlockSchema
    // demands >= 15, but the store sets in-memory FIRST and validates
    // at persist time, so the in-memory snapshot survives the throw.
    await expect(
      useScheduleStore.getState().addBlock({
        title: "bad",
        date: "2026-04-27",
        start: "09:00",
        duration: 5,
        category: "work",
        source_entity_id: null,
        status: "planned",
        notes: "",
      }),
    ).rejects.toThrow(/rejected/);
    expect(
      useScheduleStore.getState().blocks.map((b) => b.title),
    ).toContain("bad");
  });
});

describe("applyToWeek", () => {
  it("routes through the store when targeting the current week", async () => {
    fs.set(WEEK_PATH_A, weekFile(WEEK_A, []));
    await useScheduleStore.getState().loadWeek(WEEK_A);
    await applyToWeek(WEEK_A, (blocks) => [...blocks, block({ id: "bx" })]);
    expect(useScheduleStore.getState().blocks.map((b) => b.id)).toContain(
      "bx",
    );
    expect(
      (JSON.parse(fs.get(WEEK_PATH_A)!) as { blocks: Block[] }).blocks[0].id,
    ).toBe("bx");
  });

  it("read-modify-writes an off-current week without touching store state", async () => {
    fs.set(WEEK_PATH_A, weekFile(WEEK_A, [block({ id: "stay" })]));
    fs.set(WEEK_PATH_B, weekFile(WEEK_B, [block({ id: "old" })]));
    await useScheduleStore.getState().loadWeek(WEEK_A);
    await applyToWeek(WEEK_B, (blocks) =>
      blocks.concat(block({ id: "added", date: "2026-05-04" })),
    );
    // Current week stays untouched.
    expect(useScheduleStore.getState().currentWeek).toBe(WEEK_A);
    expect(useScheduleStore.getState().blocks.map((b) => b.id)).toEqual([
      "stay",
    ]);
    // Off-current week got the new block appended on disk.
    const persisted = JSON.parse(fs.get(WEEK_PATH_B)!) as { blocks: Block[] };
    expect(persisted.blocks.map((b) => b.id)).toEqual(["old", "added"]);
  });

  it("throws when the off-current week file does not exist", async () => {
    await useScheduleStore.getState().loadWeek(WEEK_A, { silentCreate: true });
    await expect(
      applyToWeek(WEEK_B, (blocks) => blocks),
    ).rejects.toThrow(/does not exist/);
  });
});

describe("findWeekContainingBlock", () => {
  it("returns the current week when the block is in-memory (hot path)", async () => {
    useScheduleStore.setState({
      currentWeek: WEEK_A,
      blocks: [block({ id: "b-hot" })],
    });
    expect(await findWeekContainingBlock("b-hot")).toBe(WEEK_A);
  });

  it("scans schedule files when the block is not in the current week", async () => {
    // Block lives on disk in WEEK_B, current week is WEEK_A with empty
    // blocks. Cold path must walk listFiles → getCachedWeek.
    useScheduleStore.setState({ currentWeek: WEEK_A, blocks: [] });
    fs.set(WEEK_PATH_B, weekFile(WEEK_B, [block({ id: "b-cold" })]));
    expect(await findWeekContainingBlock("b-cold")).toBe(WEEK_B);
  });

  it("returns null when listFiles fails", async () => {
    useScheduleStore.setState({ currentWeek: WEEK_A, blocks: [] });
    overrides.list_files = async () => {
      throw new Error("EIO");
    };
    expect(await findWeekContainingBlock("nope")).toBeNull();
  });

  it("returns null when no week file contains the block", async () => {
    useScheduleStore.setState({ currentWeek: WEEK_A, blocks: [] });
    fs.set(WEEK_PATH_B, weekFile(WEEK_B, [block({ id: "other" })]));
    expect(await findWeekContainingBlock("nope")).toBeNull();
  });
});

describe("findBlockById", () => {
  it("looks up the current week in-memory", async () => {
    useScheduleStore.setState({
      currentWeek: WEEK_A,
      blocks: [block({ id: "b1", title: "in-memory" })],
    });
    const found = await findBlockById(WEEK_A, "b1");
    expect(found?.title).toBe("in-memory");
  });

  it("reads via the week-cache for off-current weeks", async () => {
    useScheduleStore.setState({ currentWeek: WEEK_A, blocks: [] });
    fs.set(WEEK_PATH_B, weekFile(WEEK_B, [block({ id: "b2", title: "disk" })]));
    const found = await findBlockById(WEEK_B, "b2");
    expect(found?.title).toBe("disk");
  });

  it("returns null when the block is absent", async () => {
    useScheduleStore.setState({ currentWeek: WEEK_A, blocks: [] });
    expect(await findBlockById(WEEK_B, "ghost")).toBeNull();
  });
});
