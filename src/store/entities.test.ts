import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../components/shared/Toast", () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

// trackSave couples to UIStore + setTimeout, both irrelevant to what
// we're pinning here (mutation → queue → persist). Pass-thru keeps the
// store under test isolated from the save-status side-effects.
vi.mock("../services/save-status", () => ({
  trackSave: async <T>(fn: () => Promise<T>) => fn(),
}));

const fs = new Map<string, string>();
const overrides: {
  write_file?: (path: string, content: string) => void | Promise<void>;
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
        case "list_files":
          return [];
        case "ensure_dir":
          return undefined;
        default:
          return undefined;
      }
    },
  ),
}));

import { freezeClock, thawClock } from "../test/clock";
import {
  buildDirection,
  buildProject,
  buildTask,
  resetBuilderCounters,
} from "../test/builders";
import { useEntityStore } from "./entities";
import { __resetDataDirCacheForTests } from "../services/file-io";
import { flushEntitiesQueue } from "../services/entities-write-queue";

const ENTITIES_PATH = "/data/entities.json";

function readPersisted(): {
  version: number;
  entities: Array<{ id: string; type: string }>;
} {
  return JSON.parse(fs.get(ENTITIES_PATH) ?? "{}");
}

const TASK_DRAFT = {
  type: "task" as const,
  title: "T",
  tags: ["work"],
  status: "active" as const,
  priority: "medium" as const,
  deadline: null,
  estimated_minutes: null,
  description: "",
  fields: { parent_project_id: null, checklist: [] },
};

beforeEach(async () => {
  fs.clear();
  delete overrides.write_file;
  __resetDataDirCacheForTests();
  useEntityStore.setState({ entities: [], loading: false, error: null });
  resetBuilderCounters();
  await flushEntitiesQueue();
  freezeClock();
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(async () => {
  await flushEntitiesQueue();
  thawClock();
  vi.restoreAllMocks();
});

describe("loadEntities", () => {
  it("creates an empty file when entities.json is missing", async () => {
    await useEntityStore.getState().loadEntities();
    expect(useEntityStore.getState().entities).toEqual([]);
    expect(fs.has(ENTITIES_PATH)).toBe(true);
    expect(readPersisted().entities).toEqual([]);
  });

  it("loads existing entities from disk", async () => {
    const t = buildTask({ id: "t1", title: "from disk" });
    fs.set(
      ENTITIES_PATH,
      JSON.stringify({ version: 1, entities: [t] }),
    );
    await useEntityStore.getState().loadEntities();
    expect(useEntityStore.getState().entities).toEqual([t]);
  });
});

describe("addEntity", () => {
  it("generates id and timestamps when draft omits them", async () => {
    const e = await useEntityStore.getState().addEntity({ ...TASK_DRAFT });
    expect(e.id).toMatch(/^ent-/);
    expect(e.created_at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(e.updated_at).toBe(e.created_at);
    expect(e.completed_at).toBeNull();
    expect(useEntityStore.getState().entities).toHaveLength(1);
    expect(readPersisted().entities[0].id).toBe(e.id);
  });

  it("uses supplied id and timestamps (agent-supplied draft)", async () => {
    const e = await useEntityStore.getState().addEntity({
      ...TASK_DRAFT,
      id: "agent-1",
      created_at: "2025-01-01T00:00:00",
      updated_at: "2025-01-01T00:00:00",
      completed_at: null,
    });
    expect(e.id).toBe("agent-1");
    expect(e.created_at).toBe("2025-01-01T00:00:00");
  });
});

describe("updateEntity completed_at stamping", () => {
  it("stamps completed_at on active → done", async () => {
    useEntityStore.setState({
      entities: [
        buildTask({ id: "t1", status: "active", completed_at: null }),
      ],
    });
    await useEntityStore.getState().updateEntity("t1", { status: "done" });
    const t = useEntityStore.getState().entities[0];
    expect(t.completed_at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it("clears completed_at on done → active", async () => {
    useEntityStore.setState({
      entities: [
        buildTask({
          id: "t1",
          status: "done",
          completed_at: "2025-04-01T10:00:00",
        }),
      ],
    });
    await useEntityStore.getState().updateEntity("t1", { status: "active" });
    const t = useEntityStore.getState().entities[0];
    expect(t.completed_at).toBeNull();
  });

  it("does not touch completed_at when status is absent from the patch", async () => {
    useEntityStore.setState({
      entities: [
        buildTask({
          id: "t1",
          status: "done",
          completed_at: "2025-04-01T10:00:00",
        }),
      ],
    });
    await useEntityStore
      .getState()
      .updateEntity("t1", { title: "renamed" });
    const t = useEntityStore.getState().entities[0];
    expect(t.completed_at).toBe("2025-04-01T10:00:00");
    expect(t.title).toBe("renamed");
  });
});

describe("deleteEntity", () => {
  it("removes by id and persists the new array", async () => {
    useEntityStore.setState({
      entities: [buildTask({ id: "t1" }), buildTask({ id: "t2" })],
    });
    await useEntityStore.getState().deleteEntity("t1");
    expect(
      useEntityStore.getState().entities.map((e) => e.id),
    ).toEqual(["t2"]);
    expect(readPersisted().entities.map((e) => e.id)).toEqual(["t2"]);
  });
});

describe("deleteDirectionWithCascade", () => {
  it("clears direction_id on linked projects and drops the direction in one write", async () => {
    const d = buildDirection({ id: "dir-1" });
    const linked = buildProject({ id: "p-linked" });
    linked.fields.direction_id = "dir-1";
    const unlinked = buildProject({ id: "p-unlinked" });
    useEntityStore.setState({ entities: [d, linked, unlinked] });

    const writeSpy = vi.fn(async (path: string, content: string) => {
      fs.set(path, content);
    });
    overrides.write_file = writeSpy;

    await useEntityStore
      .getState()
      .deleteDirectionWithCascade("dir-1");

    const after = useEntityStore.getState().entities;
    expect(after.map((e) => e.id)).toEqual(["p-linked", "p-unlinked"]);
    const cascaded = after.find((e) => e.id === "p-linked");
    expect(
      (cascaded as { fields: { direction_id: string | null } }).fields
        .direction_id,
    ).toBeNull();
    // The cascade rebuilds in one pass — exactly one write, not N+1.
    expect(writeSpy).toHaveBeenCalledTimes(1);
  });
});

describe("persist failure", () => {
  it("leaves in-memory state intact when write fails (no rollback)", async () => {
    overrides.write_file = () => {
      throw new Error("EACCES");
    };
    await expect(
      useEntityStore.getState().addEntity({ ...TASK_DRAFT, title: "ghost" }),
    ).rejects.toThrow("EACCES");
    // Documented behavior: in-memory keeps the optimistic mutation,
    // the next save retries the same state. Tests pin it so a future
    // "let's rollback on error" refactor surfaces here, not in prod.
    expect(
      useEntityStore.getState().entities.map((e) => e.title),
    ).toContain("ghost");
  });
});

describe("concurrent writes", () => {
  it("serializes parallel addEntity through the write queue", async () => {
    const writes: string[] = [];
    overrides.write_file = (path, content) => {
      const ids = (
        JSON.parse(content) as { entities: { id: string }[] }
      ).entities
        .map((e) => e.id)
        .join(",");
      writes.push(ids);
      fs.set(path, content);
    };
    const a = useEntityStore
      .getState()
      .addEntity({ ...TASK_DRAFT, id: "a", title: "A" });
    const b = useEntityStore
      .getState()
      .addEntity({ ...TASK_DRAFT, id: "b", title: "B" });
    await Promise.all([a, b]);
    // First persist sees only A; second sees A then B. That order is
    // the contract the write-queue provides — without it, parallel
    // writes can race on disk and the slower fsync clobbers the newer.
    expect(writes).toEqual(["a", "a,b"]);
  });
});
