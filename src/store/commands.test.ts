import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../components/shared/Toast", () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

const fs = new Map<string, string>();
const overrides: {
  delete_file?: (path: string) => void | Promise<void>;
} = {};

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(
    async (
      cmd: string,
      args?: {
        path?: string;
        from?: string;
        to?: string;
        dir?: string;
        content?: string;
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
        case "list_files": {
          const dir = (a.dir ?? "").endsWith("/")
            ? (a.dir ?? "")
            : `${a.dir ?? ""}/`;
          const names: string[] = [];
          for (const k of fs.keys()) {
            if (k.startsWith(dir) && !k.slice(dir.length).includes("/")) {
              names.push(k.slice(dir.length));
            }
          }
          return names;
        }
        case "move_file": {
          const v = fs.get(a.from ?? "");
          if (v === undefined) throw new Error(`ENOENT: ${a.from}`);
          fs.set(a.to ?? "", v);
          fs.delete(a.from ?? "");
          return undefined;
        }
        case "delete_file":
          if (overrides.delete_file)
            return await overrides.delete_file(a.path ?? "");
          fs.delete(a.path ?? "");
          return undefined;
        case "ensure_dir":
          return undefined;
        default:
          return undefined;
      }
    },
  ),
}));

import { __resetDataDirCacheForTests } from "../services/file-io";
import { useCommandStore } from "./commands";
import { toast } from "../components/shared/Toast";

const FAILED_DIR = "/data/commands/failed";
const DONE_DIR = "/data/commands/done";
const PENDING_DIR = "/data/commands/pending";

function plantFailed(name: string, payload?: Partial<{
  id: string;
  action: string;
  error: string;
  failed_at: string;
}>): string {
  const path = `${FAILED_DIR}/${name}`;
  fs.set(
    path,
    JSON.stringify({
      id: payload?.id ?? "cmd-1",
      action: payload?.action ?? "add_task",
      error: payload?.error ?? "boom",
      failed_at: payload?.failed_at ?? "2025-06-11T10:00:00",
    }),
  );
  return path;
}

function plantDone(name: string, payload?: Partial<{
  id: string;
  action: string;
}>): string {
  const path = `${DONE_DIR}/${name}`;
  fs.set(
    path,
    JSON.stringify({
      id: payload?.id ?? "cmd-1",
      action: payload?.action ?? "add_task",
    }),
  );
  return path;
}

beforeEach(() => {
  fs.clear();
  delete overrides.delete_file;
  __resetDataDirCacheForTests();
  useCommandStore.setState({
    executed: 0,
    failed: [],
    done: [],
    doneTruncated: false,
  });
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("bumpExecuted", () => {
  it("increments the per-session counter", () => {
    useCommandStore.getState().bumpExecuted();
    useCommandStore.getState().bumpExecuted();
    expect(useCommandStore.getState().executed).toBe(2);
  });
});

describe("loadFailed", () => {
  it("returns records newest-first (lex-reverse by timestamp-prefixed name)", async () => {
    plantFailed("2025-01-01T10-00-00-a.json");
    plantFailed("2025-01-02T10-00-00-b.json");
    plantFailed("2025-01-03T10-00-00-c.json");
    await useCommandStore.getState().loadFailed();
    expect(
      useCommandStore.getState().failed.map((r) => r.file.id),
    ).toHaveLength(3);
    // c (latest) first, a (earliest) last
    const order = useCommandStore.getState().failed.map((r) =>
      r.path.endsWith("-c.json") ? "c" : r.path.endsWith("-b.json") ? "b" : "a",
    );
    expect(order).toEqual(["c", "b", "a"]);
  });

  it("silently skips files that fail schema validation", async () => {
    fs.set(`${FAILED_DIR}/bad.json`, "{ not json");
    fs.set(
      `${FAILED_DIR}/wrong-shape.json`,
      JSON.stringify({ id: "x" }), // missing error/failed_at
    );
    plantFailed("ok.json");
    await useCommandStore.getState().loadFailed();
    expect(useCommandStore.getState().failed).toHaveLength(1);
    expect(useCommandStore.getState().failed[0].path).toBe(
      `${FAILED_DIR}/ok.json`,
    );
  });

  it("returns gracefully when the failed/ directory does not exist", async () => {
    // No plant — listFiles will succeed with [] for a non-existent dir
    // via the mock; loadFailed must not throw.
    await useCommandStore.getState().loadFailed();
    expect(useCommandStore.getState().failed).toEqual([]);
  });

  it("skips dotfiles and non-json names", async () => {
    plantFailed(".hidden.json");
    fs.set(`${FAILED_DIR}/notes.txt`, "ignored");
    plantFailed("real.json");
    await useCommandStore.getState().loadFailed();
    expect(useCommandStore.getState().failed).toHaveLength(1);
  });
});

describe("addFailed", () => {
  it("prepends a record and dedupes by path", async () => {
    const path = plantFailed("a.json");
    await useCommandStore.getState().addFailed(path);
    await useCommandStore.getState().addFailed(path); // same path again
    expect(useCommandStore.getState().failed).toHaveLength(1);
  });

  it("is a no-op when the file fails schema validation", async () => {
    fs.set(`${FAILED_DIR}/bad.json`, "{ broken");
    await useCommandStore.getState().addFailed(`${FAILED_DIR}/bad.json`);
    expect(useCommandStore.getState().failed).toEqual([]);
  });
});

describe("removeFailed", () => {
  it("deletes the file and drops the in-memory record", async () => {
    const path = plantFailed("a.json");
    await useCommandStore.getState().loadFailed();
    await useCommandStore.getState().removeFailed(path);
    expect(fs.has(path)).toBe(false);
    expect(useCommandStore.getState().failed).toEqual([]);
  });

  it("still clears state when the underlying file is already gone", async () => {
    const path = plantFailed("a.json");
    await useCommandStore.getState().loadFailed();
    fs.delete(path); // disappear before we call removeFailed
    await useCommandStore.getState().removeFailed(path);
    expect(useCommandStore.getState().failed).toEqual([]);
  });
});

describe("retryFailed", () => {
  it("moves the file into pending/ and drops the failed record", async () => {
    const path = plantFailed("retry-me.json");
    await useCommandStore.getState().loadFailed();
    await useCommandStore.getState().retryFailed(path);
    expect(fs.has(path)).toBe(false);
    expect(fs.has(`${PENDING_DIR}/retry-me.json`)).toBe(true);
    expect(useCommandStore.getState().failed).toEqual([]);
  });
});

describe("clearAllFailed", () => {
  it("deletes every failed file and empties the in-memory list", async () => {
    plantFailed("a.json");
    plantFailed("b.json");
    plantFailed("c.json");
    await useCommandStore.getState().loadFailed();
    await useCommandStore.getState().clearAllFailed();
    expect(useCommandStore.getState().failed).toEqual([]);
    // No leftover failed/ entries on disk either.
    let remaining = 0;
    for (const k of fs.keys()) if (k.startsWith(`${FAILED_DIR}/`)) remaining++;
    expect(remaining).toBe(0);
  });

  it("keeps survivors when delete_file throws and toasts the user", async () => {
    const ok = plantFailed("ok.json");
    const stuck = plantFailed("stuck.json");
    await useCommandStore.getState().loadFailed();
    overrides.delete_file = (p) => {
      if (p === stuck) throw new Error("EBUSY");
      fs.delete(p);
    };
    await useCommandStore.getState().clearAllFailed();
    // Only the un-deleteable one survives.
    expect(
      useCommandStore.getState().failed.map((r) => r.path),
    ).toEqual([stuck]);
    expect(fs.has(ok)).toBe(false);
    expect(fs.has(stuck)).toBe(true);
    expect(toast.error).toHaveBeenCalled();
  });
});

describe("loadDone", () => {
  it("caps the in-memory list at DONE_LIMIT and flips doneTruncated past the cap", async () => {
    // Plant 205 done files. The store keeps the newest 200 in memory
    // and surfaces the truncation flag so the UI can show "..." in
    // the panel.
    for (let i = 0; i < 205; i++) {
      const stamp = String(i).padStart(4, "0");
      plantDone(`2025-01-${stamp}.json`);
    }
    await useCommandStore.getState().loadDone();
    expect(useCommandStore.getState().done).toHaveLength(200);
    expect(useCommandStore.getState().doneTruncated).toBe(true);
  });

  it("does not set doneTruncated when count is below the cap", async () => {
    plantDone("a.json");
    plantDone("b.json");
    await useCommandStore.getState().loadDone();
    expect(useCommandStore.getState().doneTruncated).toBe(false);
  });
});

describe("addDone", () => {
  it("prepends and caps the list at DONE_LIMIT", async () => {
    // Pre-fill memory with 200 dummy records.
    const pre = Array.from({ length: 200 }, (_, i) => ({
      path: `${DONE_DIR}/old-${i}.json`,
      file: { id: `c-${i}`, action: "x" },
    }));
    useCommandStore.setState({ done: pre });
    const path = plantDone("new.json");
    await useCommandStore.getState().addDone(path);
    expect(useCommandStore.getState().done).toHaveLength(200);
    // New record is first; oldest pre-fill record (index 199) is gone.
    expect(useCommandStore.getState().done[0].path).toBe(path);
    expect(
      useCommandStore.getState().done.some((r) => r.path === `${DONE_DIR}/old-199.json`),
    ).toBe(false);
  });
});

describe("removeDone / clearAllDone", () => {
  it("removeDone deletes the file and drops the record", async () => {
    const path = plantDone("a.json");
    await useCommandStore.getState().loadDone();
    await useCommandStore.getState().removeDone(path);
    expect(fs.has(path)).toBe(false);
    expect(useCommandStore.getState().done).toEqual([]);
  });

  it("clearAllDone deletes every file on disk and resets doneTruncated", async () => {
    for (let i = 0; i < 3; i++) plantDone(`a-${i}.json`);
    await useCommandStore.getState().loadDone();
    useCommandStore.setState({ doneTruncated: true });
    await useCommandStore.getState().clearAllDone();
    expect(useCommandStore.getState().done).toEqual([]);
    expect(useCommandStore.getState().doneTruncated).toBe(false);
  });
});
