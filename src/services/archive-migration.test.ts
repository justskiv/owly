import { beforeEach, describe, expect, it, vi } from "vitest";

// In-memory filesystem mock — invoke gets routed through this map so
// we can assert on what got written. The real Tauri runtime is never
// reached in unit tests, and the file-io sandbox guard refuses to
// invoke without an installed mock, so we substitute the lower-level
// `@tauri-apps/api/core` invoke directly.
const files = new Map<string, string>();

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(async (cmd: string, args?: { path?: string; content?: string }) => {
    const a = args ?? {};
    switch (cmd) {
      case "get_data_dir":
        return "/data";
      case "file_exists":
        return files.has(a.path ?? "");
      case "read_file": {
        const v = files.get(a.path ?? "");
        if (v === undefined) throw new Error(`ENOENT: ${a.path}`);
        return v;
      }
      case "write_file":
        files.set(a.path ?? "", a.content ?? "");
        return undefined;
      default:
        return undefined;
    }
  }),
}));

vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn(async () => () => undefined),
}));

import {
  __resetArchiveMigrationForTests,
  maybeBackfillCompletedAt,
} from "./archive-migration";
import { __resetDataDirCacheForTests } from "./file-io";

const ROOT = "/data";
const ENTITIES = `${ROOT}/entities.json`;
const MARKER = `${ROOT}/.archive-migrated-v1`;

// Unit tests run in node env where `window` doesn't exist. The
// file-io sandbox guard asks for both __APP_MODE__ and a window with
// __TAURI_INTERNALS__ — by leaving __APP_MODE__ unset we skip the
// guard entirely (it gates only on test mode, and prod would not
// reach the test file).

function seed(entities: object[]): void {
  files.clear();
  files.set(
    ENTITIES,
    JSON.stringify({ version: 1, entities }, null, 2),
  );
}

function readEntities(): { version: number; entities: Array<Record<string, unknown>> } {
  return JSON.parse(files.get(ENTITIES) ?? "{}");
}

beforeEach(() => {
  files.clear();
  __resetArchiveMigrationForTests();
  __resetDataDirCacheForTests();
});

const NOW = "2026-05-08T10:00:00";

const taskBase = {
  type: "task",
  title: "T",
  tags: ["life"],
  priority: "medium",
  deadline: null,
  estimated_minutes: null,
  description: "",
  fields: { parent_project_id: null, checklist: [] },
};

describe("maybeBackfillCompletedAt", () => {
  it("backfills completed_at = updated_at on legacy done tasks", async () => {
    seed([
      {
        ...taskBase,
        id: "t1",
        status: "done",
        created_at: "2026-04-01T10:00:00",
        updated_at: "2026-04-15T10:00:00",
        completed_at: null,
      },
    ]);
    await maybeBackfillCompletedAt();
    const file = readEntities();
    expect(file.entities[0].completed_at).toBe("2026-04-15T10:00:00");
  });

  it("does not touch active tasks", async () => {
    seed([
      {
        ...taskBase,
        id: "t1",
        status: "active",
        created_at: "2026-04-01T10:00:00",
        updated_at: "2026-04-15T10:00:00",
        completed_at: null,
      },
    ]);
    await maybeBackfillCompletedAt();
    const file = readEntities();
    expect(file.entities[0].completed_at).toBeNull();
  });

  it("does not overwrite an already-set completed_at", async () => {
    seed([
      {
        ...taskBase,
        id: "t1",
        status: "done",
        created_at: "2026-04-01T10:00:00",
        updated_at: "2026-04-20T10:00:00",
        completed_at: "2026-04-15T10:00:00",
      },
    ]);
    await maybeBackfillCompletedAt();
    const file = readEntities();
    expect(file.entities[0].completed_at).toBe("2026-04-15T10:00:00");
  });

  it("writes a marker file so subsequent calls are no-ops", async () => {
    seed([
      {
        ...taskBase,
        id: "t1",
        status: "done",
        created_at: NOW,
        updated_at: NOW,
        completed_at: null,
      },
    ]);
    await maybeBackfillCompletedAt();
    expect(files.has(MARKER)).toBe(true);

    // Mutate file directly; second call must NOT re-process it.
    files.set(
      ENTITIES,
      JSON.stringify(
        {
          version: 1,
          entities: [
            {
              ...taskBase,
              id: "t1",
              status: "done",
              created_at: NOW,
              updated_at: NOW,
              completed_at: null,
            },
          ],
        },
        null,
        2,
      ),
    );
    __resetArchiveMigrationForTests();
    await maybeBackfillCompletedAt();
    const file = readEntities();
    expect(file.entities[0].completed_at).toBeNull();
  });
});
