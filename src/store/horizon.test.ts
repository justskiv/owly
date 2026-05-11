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
import { __resetDataDirCacheForTests } from "../services/file-io";
import { flushHorizonQueue } from "../services/horizon-write-queue";
import { useHorizonStore } from "./horizon";

const HORIZON_PATH = "/data/horizon.json";

function readPersisted(): {
  base_month: string;
  projects: { project_id: string; months: number[]; size: string; hidden: boolean }[];
  group_collapsed: { big: boolean; mid: boolean; small: boolean };
  section_collapsed: { active: boolean; someday: boolean; deferred: boolean };
} {
  return JSON.parse(fs.get(HORIZON_PATH) ?? "{}");
}

beforeEach(async () => {
  fs.clear();
  delete overrides.write_file;
  __resetDataDirCacheForTests();
  useHorizonStore.setState({
    baseMonth: "2026-05-01",
    projects: [],
    groupCollapsed: { big: false, mid: false, small: false },
    sectionCollapsed: { active: false, someday: false, deferred: true },
    loading: false,
    error: null,
  });
  await flushHorizonQueue();
  freezeClock();
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(async () => {
  await flushHorizonQueue();
  thawClock();
  vi.restoreAllMocks();
});

describe("load", () => {
  it("creates an empty horizon file when missing", async () => {
    await useHorizonStore.getState().load();
    expect(fs.has(HORIZON_PATH)).toBe(true);
    expect(useHorizonStore.getState().projects).toEqual([]);
    // section_collapsed.deferred defaults to true — that's the
    // out-of-the-box hint from the schema, pin it so an accidental
    // default flip surfaces here.
    expect(useHorizonStore.getState().sectionCollapsed.deferred).toBe(true);
  });

  it("loads an existing horizon file from disk", async () => {
    fs.set(
      HORIZON_PATH,
      JSON.stringify({
        version: 1,
        base_month: "2026-01-01",
        projects: [
          { project_id: "p1", months: [0, 2], size: "big", hidden: false },
        ],
        group_collapsed: { big: false, mid: true, small: false },
        section_collapsed: { active: false, someday: true, deferred: false },
      }),
    );
    await useHorizonStore.getState().load();
    expect(useHorizonStore.getState().baseMonth).toBe("2026-01-01");
    expect(useHorizonStore.getState().projects).toHaveLength(1);
    expect(useHorizonStore.getState().groupCollapsed.mid).toBe(true);
    expect(useHorizonStore.getState().sectionCollapsed.someday).toBe(true);
  });
});

describe("addProject", () => {
  it("appends a new project with defaults", async () => {
    await useHorizonStore.getState().addProject("p1");
    const projects = useHorizonStore.getState().projects;
    expect(projects).toHaveLength(1);
    expect(projects[0]).toEqual({
      project_id: "p1",
      months: [],
      size: "mid",
      hidden: false,
    });
    expect(readPersisted().projects[0].project_id).toBe("p1");
  });

  it("honors a custom size", async () => {
    await useHorizonStore.getState().addProject("p1", { size: "big" });
    expect(useHorizonStore.getState().projects[0].size).toBe("big");
  });

  it("is a no-op when the project is already pinned", async () => {
    // Idempotency matters because the command-executor can be told to
    // pin the same project twice on retries. Without this guard we'd
    // duplicate the row and break the unique-key invariant the UI
    // assumes.
    useHorizonStore.setState({
      projects: [
        { project_id: "p1", months: [3], size: "big", hidden: false },
      ],
    });
    await useHorizonStore.getState().addProject("p1");
    const projects = useHorizonStore.getState().projects;
    expect(projects).toHaveLength(1);
    expect(projects[0].months).toEqual([3]);
    expect(projects[0].size).toBe("big");
  });
});

describe("setMonths / setHidden / setSize", () => {
  beforeEach(() => {
    useHorizonStore.setState({
      projects: [
        { project_id: "p1", months: [0], size: "mid", hidden: false },
        { project_id: "p2", months: [1], size: "small", hidden: false },
      ],
    });
  });

  it("setMonths patches one project and leaves others alone", async () => {
    await useHorizonStore.getState().setMonths("p1", [4, 5, 6]);
    const projects = useHorizonStore.getState().projects;
    expect(projects.find((p) => p.project_id === "p1")?.months).toEqual([
      4, 5, 6,
    ]);
    expect(projects.find((p) => p.project_id === "p2")?.months).toEqual([1]);
  });

  it("setHidden flips a single project's hidden flag", async () => {
    await useHorizonStore.getState().setHidden("p2", true);
    expect(
      useHorizonStore
        .getState()
        .projects.find((p) => p.project_id === "p2")?.hidden,
    ).toBe(true);
    expect(readPersisted().projects.find((p) => p.project_id === "p2")?.hidden)
      .toBe(true);
  });

  it("setSize updates one project's size", async () => {
    await useHorizonStore.getState().setSize("p1", "big");
    expect(
      useHorizonStore
        .getState()
        .projects.find((p) => p.project_id === "p1")?.size,
    ).toBe("big");
  });
});

describe("toggleGroup / toggleSection", () => {
  it("toggleGroup flips one group and persists", async () => {
    await useHorizonStore.getState().toggleGroup("big");
    expect(useHorizonStore.getState().groupCollapsed.big).toBe(true);
    expect(readPersisted().group_collapsed.big).toBe(true);
    await useHorizonStore.getState().toggleGroup("big");
    expect(useHorizonStore.getState().groupCollapsed.big).toBe(false);
  });

  it("toggleSection flips one section and persists", async () => {
    await useHorizonStore.getState().toggleSection("someday");
    expect(useHorizonStore.getState().sectionCollapsed.someday).toBe(true);
    expect(readPersisted().section_collapsed.someday).toBe(true);
  });
});

describe("removeProject", () => {
  it("filters by id and persists the new array", async () => {
    useHorizonStore.setState({
      projects: [
        { project_id: "p1", months: [], size: "mid", hidden: false },
        { project_id: "p2", months: [], size: "mid", hidden: false },
      ],
    });
    await useHorizonStore.getState().removeProject("p1");
    expect(
      useHorizonStore.getState().projects.map((p) => p.project_id),
    ).toEqual(["p2"]);
    expect(readPersisted().projects.map((p) => p.project_id)).toEqual(["p2"]);
  });
});

describe("persist failure", () => {
  it("keeps the optimistic in-memory mutation when write fails", async () => {
    overrides.write_file = () => {
      throw new Error("EACCES");
    };
    await expect(
      useHorizonStore.getState().addProject("ghost"),
    ).rejects.toThrow("EACCES");
    // Same optimistic-no-rollback contract as entities/config/pool:
    // the next save retries from in-memory rather than dropping the
    // user's edit.
    expect(
      useHorizonStore.getState().projects.map((p) => p.project_id),
    ).toContain("ghost");
  });
});

describe("concurrent writes", () => {
  it("serializes parallel mutations through the global horizon queue", async () => {
    const writes: string[] = [];
    overrides.write_file = (path, content) => {
      const ids = (
        JSON.parse(content) as { projects: { project_id: string }[] }
      ).projects
        .map((p) => p.project_id)
        .join(",");
      writes.push(ids);
      fs.set(path, content);
    };
    const a = useHorizonStore.getState().addProject("p1");
    const b = useHorizonStore.getState().addProject("p2");
    await Promise.all([a, b]);
    // First persist sees only p1, second sees p1 then p2 — submission
    // order survives the queue.
    expect(writes).toEqual(["p1", "p1,p2"]);
  });
});
