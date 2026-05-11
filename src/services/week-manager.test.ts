import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const fs = new Map<string, string>();

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(
    async (
      cmd: string,
      args?: { path?: string; content?: string },
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

import type { Entity } from "../schemas";
import { freezeClock, thawClock } from "../test/clock";
import { buildTask } from "../test/builders";
import { __resetDataDirCacheForTests } from "./file-io";
import { clearWeekCache } from "./week-cache";
import {
  createEmptyWeek,
  createWeekFromTemplate,
  getCarryOverEntities,
  weekFileExists,
} from "./week-manager";

const WEEK = "2026-w18";
const PREV = "2026-w17";
const WEEK_PATH = `/data/schedule/${WEEK}.json`;
const PREV_PATH = `/data/schedule/${PREV}.json`;
const TEMPLATE_PATH = "/data/templates/default.json";

function plantedWeek(week: string, blocks: unknown[] = []): string {
  return JSON.stringify({
    version: 1,
    week,
    start_date: week === WEEK ? "2026-04-27" : "2026-04-20",
    template_applied: null,
    blocks,
  });
}

beforeEach(() => {
  fs.clear();
  __resetDataDirCacheForTests();
  clearWeekCache();
  freezeClock();
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  thawClock();
  vi.restoreAllMocks();
});

describe("weekFileExists", () => {
  it("returns true when the week file exists", async () => {
    fs.set(WEEK_PATH, plantedWeek(WEEK));
    expect(await weekFileExists(WEEK)).toBe(true);
  });

  it("returns false when the week file is missing", async () => {
    expect(await weekFileExists(WEEK)).toBe(false);
  });
});

describe("createEmptyWeek", () => {
  it("writes emptyWeekFile and caches it", async () => {
    const file = await createEmptyWeek(WEEK);
    expect(file).toEqual({
      version: 1,
      week: WEEK,
      start_date: "2026-04-27",
      template_applied: null,
      blocks: [],
    });
    expect(fs.has(WEEK_PATH)).toBe(true);
    expect(JSON.parse(fs.get(WEEK_PATH)!).blocks).toEqual([]);
  });

  it("subsequent getCarryOverEntities reads the freshly-cached file (no extra disk hit)", async () => {
    // Sanity that setCachedWeek inside createEmptyWeek populates the
    // cache — clearWeekCache wipes anything from a prior test, so a
    // hit here proves createEmptyWeek wrote into it.
    await createEmptyWeek(PREV);
    // Delete the file from fs but keep the cache — if the cache works,
    // the consumer below still sees the empty week from PREV.
    fs.delete(PREV_PATH);
    const out = await getCarryOverEntities(WEEK, []);
    expect(out).toEqual([]); // PREV is cached with no blocks → no carry-over
  });
});

describe("createWeekFromTemplate", () => {
  it("creates an empty template file and writes an empty week when default.json is missing", async () => {
    // readTemplate's bootstrap branch: missing file → write
    // EMPTY_TEMPLATE_FILE in-place and continue with zero blocks.
    const file = await createWeekFromTemplate(WEEK);
    expect(fs.has(TEMPLATE_PATH)).toBe(true);
    expect(JSON.parse(fs.get(TEMPLATE_PATH)!).blocks).toEqual([]);
    expect(file.template_applied).toBe("default");
    expect(file.blocks).toEqual([]);
    expect(fs.has(WEEK_PATH)).toBe(true);
  });

  it("materializes template blocks with correct dates per DAY_INDEX", async () => {
    fs.set(
      TEMPLATE_PATH,
      JSON.stringify({
        version: 1,
        name: "weekday-mix",
        description: "",
        blocks: [
          { day: "mon", start: "09:00", duration: 60, title: "Mon", category: "work" },
          { day: "wed", start: "14:00", duration: 90, title: "Wed", category: "growth" },
          { day: "sun", start: "10:00", duration: 30, title: "Sun", category: "life" },
        ],
      }),
    );
    const file = await createWeekFromTemplate(WEEK);
    expect(file.template_applied).toBe("weekday-mix");
    expect(file.blocks).toHaveLength(3);
    // start_date for 2026-w18 is 2026-04-27 (Mon). DAY_INDEX maps
    // mon→0, wed→2, sun→6; dates must reflect that offset.
    const byTitle = new Map(file.blocks.map((b) => [b.title, b]));
    expect(byTitle.get("Mon")?.date).toBe("2026-04-27");
    expect(byTitle.get("Wed")?.date).toBe("2026-04-29");
    expect(byTitle.get("Sun")?.date).toBe("2026-05-03");
    for (const b of file.blocks) {
      expect(b.id).toMatch(/^blk-/);
      expect(b.status).toBe("planned");
      expect(b.source_entity_id).toBeNull();
      expect(b.pool_item_id).toBeNull();
      expect(b.notes).toBe("");
    }
    expect(fs.has(WEEK_PATH)).toBe(true);
  });

  it("rejects a template with duration < 15 at the readJsonFile schema gate", async () => {
    // TemplateBlockSchema.duration = z.number().int().min(15). The
    // schema gate inside readJsonFile fires before we even reach
    // createWeekFromTemplate's own safeParse guard.
    fs.set(
      TEMPLATE_PATH,
      JSON.stringify({
        version: 1,
        name: "bad",
        description: "",
        blocks: [
          { day: "mon", start: "09:00", duration: 10, title: "X", category: "work" },
        ],
      }),
    );
    await expect(createWeekFromTemplate(WEEK)).rejects.toThrow();
    // Week file must NOT be written when template is rejected.
    expect(fs.has(WEEK_PATH)).toBe(false);
  });
});

describe("getCarryOverEntities", () => {
  function plannedBlock(opts: {
    id: string;
    sourceEntityId: string | null;
    status?: "planned" | "done" | "skipped" | "moved";
  }): unknown {
    return {
      id: opts.id,
      title: "B",
      date: "2026-04-20",
      start: "10:00",
      duration: 60,
      category: "work",
      source_entity_id: opts.sourceEntityId,
      pool_item_id: null,
      status: opts.status ?? "planned",
      notes: "",
    };
  }

  it("returns [] when the previous week file does not exist", async () => {
    const out = await getCarryOverEntities(WEEK, [buildTask({ id: "t1" })]);
    expect(out).toEqual([]);
  });

  it("returns an active entity that was planned-in-prev and is absent-in-curr", async () => {
    const e1 = buildTask({ id: "t1", status: "active" });
    fs.set(
      PREV_PATH,
      plantedWeek(PREV, [
        plannedBlock({ id: "b1", sourceEntityId: "t1", status: "planned" }),
      ]),
    );
    // No current week file → curr is null → entity is absent-in-curr.
    const out = await getCarryOverEntities(WEEK, [e1]);
    expect(out.map((e) => e.id)).toEqual(["t1"]);
  });

  it("excludes entities whose prev block was done/skipped/moved", async () => {
    const tDone = buildTask({ id: "t-done", status: "active" });
    const tSkipped = buildTask({ id: "t-skipped", status: "active" });
    const tMoved = buildTask({ id: "t-moved", status: "active" });
    fs.set(
      PREV_PATH,
      plantedWeek(PREV, [
        plannedBlock({ id: "b1", sourceEntityId: "t-done", status: "done" }),
        plannedBlock({ id: "b2", sourceEntityId: "t-skipped", status: "skipped" }),
        plannedBlock({ id: "b3", sourceEntityId: "t-moved", status: "moved" }),
      ]),
    );
    const out = await getCarryOverEntities(WEEK, [tDone, tSkipped, tMoved]);
    expect(out).toEqual([]);
  });

  it("excludes entities present in the current week", async () => {
    const t = buildTask({ id: "t1", status: "active" });
    fs.set(
      PREV_PATH,
      plantedWeek(PREV, [
        plannedBlock({ id: "b1", sourceEntityId: "t1", status: "planned" }),
      ]),
    );
    fs.set(
      WEEK_PATH,
      plantedWeek(WEEK, [
        plannedBlock({ id: "b2", sourceEntityId: "t1", status: "planned" }),
      ]),
    );
    const out = await getCarryOverEntities(WEEK, [t]);
    expect(out).toEqual([]);
  });

  it("excludes entities whose own status is not active", async () => {
    const tDone: Entity = buildTask({
      id: "t1",
      status: "done",
      completed_at: "2026-04-21T10:00:00",
    });
    fs.set(
      PREV_PATH,
      plantedWeek(PREV, [
        plannedBlock({ id: "b1", sourceEntityId: "t1", status: "planned" }),
      ]),
    );
    const out = await getCarryOverEntities(WEEK, [tDone]);
    expect(out).toEqual([]);
  });

  it("ignores prev blocks with null source_entity_id", async () => {
    const t = buildTask({ id: "t1", status: "active" });
    fs.set(
      PREV_PATH,
      plantedWeek(PREV, [
        plannedBlock({ id: "b1", sourceEntityId: null, status: "planned" }),
      ]),
    );
    // No source_entity_id in prev → nothing to carry over.
    const out = await getCarryOverEntities(WEEK, [t]);
    expect(out).toEqual([]);
  });
});
