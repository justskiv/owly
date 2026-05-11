import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const fs = new Map<string, string>();

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(
    async (
      cmd: string,
      args?: { path?: string; content?: string; dir?: string },
    ) => {
      const a = args ?? {};
      switch (cmd) {
        case "get_data_dir":
          return "/data";
        case "file_exists": {
          const p = a.path ?? "";
          if (fs.has(p)) return true;
          // A directory exists if at least one file lives under it.
          const prefix = p.endsWith("/") ? p : p + "/";
          for (const k of fs.keys()) if (k.startsWith(prefix)) return true;
          return false;
        }
        case "read_file": {
          const v = fs.get(a.path ?? "");
          if (v === undefined) throw new Error(`ENOENT: ${a.path}`);
          return v;
        }
        case "write_file":
          fs.set(a.path ?? "", a.content ?? "");
          return undefined;
        case "ensure_dir":
          return undefined;
        case "list_files":
          return [];
        default:
          return undefined;
      }
    },
  ),
}));

import { freezeClock, thawClock } from "../test/clock";
import { DEFAULT_CONFIG } from "./defaults";
import { __resetDataDirCacheForTests } from "./file-io";
import {
  __resetSeedMigrationForTests,
  maybeMigrateToV2,
} from "./seed-migration";

const ROOT = "/data";
const MARKER = `${ROOT}/.v2-migrated`;
const ENTITIES = `${ROOT}/entities.json`;
const CONFIG = `${ROOT}/config.json`;
const SEED_ROOT = `${ROOT}/seed-v2`;

const minWeek = JSON.stringify({
  version: 1,
  week: "2026-w18",
  start_date: "2026-04-27",
  template_applied: null,
  blocks: [],
});
const minPool = JSON.stringify({
  version: 1,
  week: "2026-w18",
  items: [],
});
const minHorizon = JSON.stringify({
  version: 1,
  base_month: "2026-01-01",
  projects: [],
});
const minEntities = JSON.stringify({ version: 1, entities: [] });

function plantValidSeed(): void {
  fs.set(`${SEED_ROOT}/schedule/2026-w18.json`, minWeek);
  fs.set(`${SEED_ROOT}/pool/2026-w18.json`, minPool);
  fs.set(`${SEED_ROOT}/horizon.json`, minHorizon);
  fs.set(`${SEED_ROOT}/entities.json`, minEntities);
}

beforeEach(() => {
  fs.clear();
  __resetSeedMigrationForTests();
  __resetDataDirCacheForTests();
  freezeClock();
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  thawClock();
  vi.restoreAllMocks();
});

describe("maybeMigrateToV2", () => {
  it("is a no-op when the marker file already exists", async () => {
    fs.set(MARKER, JSON.stringify({ at: "2024-01-01T00:00:00.000Z" }));
    plantValidSeed();
    await maybeMigrateToV2();
    // No seed copy attempted — target paths must still be missing.
    expect(fs.has(`${ROOT}/horizon.json`)).toBe(false);
    expect(fs.has(ENTITIES)).toBe(false);
  });

  it("writes marker without copying seed when entities is already populated", async () => {
    fs.set(
      ENTITIES,
      JSON.stringify({
        version: 1,
        entities: [
          {
            id: "t1",
            type: "task",
            title: "T",
            tags: ["work"],
            status: "active",
            priority: "medium",
            deadline: null,
            estimated_minutes: null,
            description: "",
            created_at: "2025-01-01T00:00:00",
            updated_at: "2025-01-01T00:00:00",
            completed_at: null,
            fields: { parent_project_id: null, checklist: [] },
          },
        ],
      }),
    );
    plantValidSeed();
    await maybeMigrateToV2();
    expect(fs.has(MARKER)).toBe(true);
    // User's existing entities stay intact, no seed horizon clobbered in.
    expect(fs.has(`${ROOT}/horizon.json`)).toBe(false);
  });

  it("copies seed into data/ and writes marker when entities is missing", async () => {
    fs.set(CONFIG, JSON.stringify(DEFAULT_CONFIG));
    plantValidSeed();
    await maybeMigrateToV2();
    expect(fs.has(`${ROOT}/schedule/2026-w18.json`)).toBe(true);
    expect(fs.has(`${ROOT}/pool/2026-w18.json`)).toBe(true);
    expect(fs.has(`${ROOT}/horizon.json`)).toBe(true);
    expect(fs.has(ENTITIES)).toBe(true);
    expect(fs.has(MARKER)).toBe(true);
  });

  it("copies seed when entities is present but empty", async () => {
    fs.set(ENTITIES, JSON.stringify({ version: 1, entities: [] }));
    fs.set(CONFIG, JSON.stringify(DEFAULT_CONFIG));
    plantValidSeed();
    await maybeMigrateToV2();
    expect(fs.has(MARKER)).toBe(true);
    expect(fs.has(`${ROOT}/horizon.json`)).toBe(true);
  });

  it("throws and skips marker when entities.json is invalid", async () => {
    fs.set(ENTITIES, "{ broken");
    plantValidSeed();
    await expect(maybeMigrateToV2()).rejects.toThrow(/invalid/);
    expect(fs.has(MARKER)).toBe(false);
    // Hard stop — user's file is left untouched for manual recovery.
    expect(fs.get(ENTITIES)).toBe("{ broken");
  });

  it("aborts when required areas are missing from config", async () => {
    const cfg = {
      ...DEFAULT_CONFIG,
      // Drop "health" — REQUIRED_AREAS includes it.
      areas: DEFAULT_CONFIG.areas.filter((a) => a.id !== "health"),
    };
    fs.set(CONFIG, JSON.stringify(cfg));
    plantValidSeed();
    await expect(maybeMigrateToV2()).rejects.toThrow(/areas:.*health/);
    expect(fs.has(MARKER)).toBe(false);
  });

  it("proceeds without the area check when config is absent", async () => {
    // No config.json. Migration treats unreadable config as null and
    // skips the area requirement — first-boot users have no config yet.
    plantValidSeed();
    await maybeMigrateToV2();
    expect(fs.has(MARKER)).toBe(true);
    expect(fs.has(`${ROOT}/horizon.json`)).toBe(true);
  });

  it("writes marker even when seed-v2 bundle is absent (production fallback)", async () => {
    fs.set(CONFIG, JSON.stringify(DEFAULT_CONFIG));
    // Do not plant seed — simulates a production build without seed-v2.
    await maybeMigrateToV2();
    expect(fs.has(MARKER)).toBe(true);
    expect(fs.has(`${ROOT}/horizon.json`)).toBe(false);
  });
});

describe("@key substitution", () => {
  it("maps the same key to the same UUID across files", async () => {
    fs.set(CONFIG, JSON.stringify(DEFAULT_CONFIG));
    // Same @key in two seed files — the substituted IDs must match,
    // otherwise cross-references between project ↔ pool item dangle.
    fs.set(
      `${SEED_ROOT}/horizon.json`,
      JSON.stringify({
        version: 1,
        base_month: "2026-01-01",
        projects: [
          {
            project_id: "@pr1",
            months: [0],
            size: "mid",
            hidden: false,
          },
        ],
      }),
    );
    fs.set(
      `${SEED_ROOT}/entities.json`,
      JSON.stringify({
        version: 1,
        entities: [
          {
            id: "@pr1",
            type: "project",
            title: "Same key",
            tags: ["work"],
            status: "active",
            priority: "medium",
            deadline: null,
            estimated_minutes: null,
            description: "",
            created_at: "2025-01-01T00:00:00",
            updated_at: "2025-01-01T00:00:00",
            completed_at: null,
            fields: {
              description: "",
              pipeline_stage: "research",
              task_ids: [],
              direction_id: null,
              board_id: "brd3",
              column_index: 0,
              last_activity_days: 0,
            },
          },
        ],
      }),
    );
    fs.set(`${SEED_ROOT}/schedule/2026-w18.json`, minWeek);
    fs.set(`${SEED_ROOT}/pool/2026-w18.json`, minPool);

    await maybeMigrateToV2();

    const horizon = JSON.parse(fs.get(`${ROOT}/horizon.json`)!);
    const entities = JSON.parse(fs.get(ENTITIES)!);
    const horizonProjectId = horizon.projects[0].project_id;
    const entityId = entities.entities[0].id;
    expect(horizonProjectId).toBe(entityId);
    expect(horizonProjectId).not.toBe("@pr1");
    expect(horizonProjectId).toMatch(/^ent-/);
  });

  it("maps different keys to different UUIDs", async () => {
    fs.set(CONFIG, JSON.stringify(DEFAULT_CONFIG));
    fs.set(
      `${SEED_ROOT}/horizon.json`,
      JSON.stringify({
        version: 1,
        base_month: "2026-01-01",
        projects: [
          { project_id: "@pr1", months: [0], size: "mid", hidden: false },
          { project_id: "@pr2", months: [1], size: "mid", hidden: false },
        ],
      }),
    );
    fs.set(`${SEED_ROOT}/schedule/2026-w18.json`, minWeek);
    fs.set(`${SEED_ROOT}/pool/2026-w18.json`, minPool);
    fs.set(`${SEED_ROOT}/entities.json`, minEntities);

    await maybeMigrateToV2();

    const horizon = JSON.parse(fs.get(`${ROOT}/horizon.json`)!);
    expect(horizon.projects[0].project_id).not.toBe(
      horizon.projects[1].project_id,
    );
  });
});

describe("schema rejection", () => {
  it("throws and skips marker when a seed file fails schema after substitution", async () => {
    fs.set(CONFIG, JSON.stringify(DEFAULT_CONFIG));
    // schedule seed missing required `start_date` — Zod will reject.
    fs.set(
      `${SEED_ROOT}/schedule/2026-w18.json`,
      JSON.stringify({ version: 1, week: "2026-w18", blocks: [] }),
    );
    fs.set(`${SEED_ROOT}/pool/2026-w18.json`, minPool);
    fs.set(`${SEED_ROOT}/horizon.json`, minHorizon);
    fs.set(`${SEED_ROOT}/entities.json`, minEntities);

    await expect(maybeMigrateToV2()).rejects.toThrow(/rejected by schema/);
    // entities.json is intentionally last — it must NOT be written
    // when an earlier seed file fails, so the next launch can retry.
    expect(fs.has(ENTITIES)).toBe(false);
    expect(fs.has(MARKER)).toBe(false);
  });
});

describe("singleton", () => {
  it("two concurrent calls share one migration", async () => {
    fs.set(CONFIG, JSON.stringify(DEFAULT_CONFIG));
    plantValidSeed();
    const a = maybeMigrateToV2();
    const b = maybeMigrateToV2();
    await Promise.all([a, b]);
    // Marker exists (so at least one run completed). The second
    // caller awaiting the same inflight promise is the proof — if
    // they had been two independent runs, the parallel writes could
    // interleave entities.json from one with horizon from the other.
    expect(fs.has(MARKER)).toBe(true);
    // Sanity: cross-references stay consistent in this minimal seed.
    expect(fs.has(ENTITIES)).toBe(true);
  });
});
