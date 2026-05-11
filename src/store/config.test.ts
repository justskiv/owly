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
import { useConfigStore } from "./config";
import { DEFAULT_CONFIG } from "../services/defaults";
import { __resetDataDirCacheForTests } from "../services/file-io";
import { flushConfigQueue } from "../services/config-write-queue";
import type { Area } from "../schemas";

const CONFIG_PATH = "/data/config.json";

function readPersisted(): typeof DEFAULT_CONFIG {
  return JSON.parse(fs.get(CONFIG_PATH) ?? "{}");
}

beforeEach(async () => {
  fs.clear();
  delete overrides.write_file;
  __resetDataDirCacheForTests();
  useConfigStore.setState({ config: null, loading: false, error: null });
  await flushConfigQueue();
  freezeClock();
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(async () => {
  await flushConfigQueue();
  thawClock();
  vi.restoreAllMocks();
});

describe("loadConfig", () => {
  it("creates the default file when config.json is missing", async () => {
    await useConfigStore.getState().loadConfig();
    expect(useConfigStore.getState().config).toEqual(DEFAULT_CONFIG);
    expect(fs.has(CONFIG_PATH)).toBe(true);
  });

  it("loads an existing config from disk", async () => {
    const modified = {
      ...DEFAULT_CONFIG,
      pipeline_stages: ["custom"],
    };
    fs.set(CONFIG_PATH, JSON.stringify(modified));
    await useConfigStore.getState().loadConfig();
    expect(useConfigStore.getState().config?.pipeline_stages).toEqual([
      "custom",
    ]);
  });
});

describe("setAreas", () => {
  it("patches areas in-memory and persists", async () => {
    useConfigStore.setState({ config: DEFAULT_CONFIG });
    const newAreas: Area[] = [
      { id: "solo", label: "Solo", color: "#abcdef", icon: "user" },
    ];
    await useConfigStore.getState().setAreas(newAreas);
    expect(useConfigStore.getState().config?.areas).toEqual(newAreas);
    expect(readPersisted().areas).toEqual(newAreas);
  });

  it("is a no-op when config is not loaded yet", async () => {
    // Without a loaded config the store has nothing to patch — the
    // method must early-return rather than write a partial file.
    await useConfigStore.getState().setAreas([
      { id: "x", label: "x", color: "#000", icon: "" },
    ]);
    expect(useConfigStore.getState().config).toBeNull();
    expect(fs.has(CONFIG_PATH)).toBe(false);
  });
});

describe("setPipelineStages", () => {
  it("patches pipeline_stages and persists", async () => {
    useConfigStore.setState({ config: DEFAULT_CONFIG });
    await useConfigStore
      .getState()
      .setPipelineStages(["a", "b", "c"]);
    expect(useConfigStore.getState().config?.pipeline_stages).toEqual([
      "a",
      "b",
      "c",
    ]);
    expect(readPersisted().pipeline_stages).toEqual(["a", "b", "c"]);
  });
});

describe("setSchedulingPrefs", () => {
  it("patches scheduling_preferences and persists", async () => {
    useConfigStore.setState({ config: DEFAULT_CONFIG });
    const next = {
      ...DEFAULT_CONFIG.scheduling_preferences,
      no_calls_before: "09:00",
    };
    await useConfigStore.getState().setSchedulingPrefs(next);
    expect(
      useConfigStore.getState().config?.scheduling_preferences.no_calls_before,
    ).toBe("09:00");
    expect(readPersisted().scheduling_preferences.no_calls_before).toBe(
      "09:00",
    );
  });
});

describe("persist failure", () => {
  it("keeps the optimistic in-memory mutation when write fails", async () => {
    useConfigStore.setState({ config: DEFAULT_CONFIG });
    overrides.write_file = () => {
      throw new Error("EACCES");
    };
    const ghostAreas: Area[] = [
      { id: "ghost", label: "G", color: "#000", icon: "" },
    ];
    await expect(
      useConfigStore.getState().setAreas(ghostAreas),
    ).rejects.toThrow("EACCES");
    // Optimistic-no-rollback contract — same as entities store. Next
    // save retries from the in-memory snapshot.
    expect(useConfigStore.getState().config?.areas).toEqual(ghostAreas);
  });
});

describe("concurrent writes", () => {
  it("serializes rapid Settings mutations through the queue", async () => {
    useConfigStore.setState({ config: DEFAULT_CONFIG });
    const writes: string[] = [];
    overrides.write_file = (path, content) => {
      writes.push(
        (JSON.parse(content) as { pipeline_stages: string[] })
          .pipeline_stages.join("|"),
      );
      fs.set(path, content);
    };
    // Two quick mutations targeting different slots of the same file —
    // both must land on disk in submission order, not race-write.
    const a = useConfigStore
      .getState()
      .setPipelineStages(["first"]);
    const b = useConfigStore
      .getState()
      .setPipelineStages(["first", "second"]);
    await Promise.all([a, b]);
    expect(writes).toEqual(["first", "first|second"]);
  });
});
