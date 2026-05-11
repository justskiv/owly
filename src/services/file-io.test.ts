import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Toast is a Zustand store that schedules a window.setTimeout — neither
// is available in the node unit env, so swap the public API for spies.
vi.mock("../components/shared/Toast", () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

// In-memory FS shared by the mocked invoke. Tests seed via `fs.set`
// and inject per-test failure-mode behavior via `overrides`. The
// closure over both works because vitest evaluates the mock factory
// after module init.
const fs = new Map<string, string>();
type Override = {
  read_file?: (path: string) => string | Promise<string>;
  write_file?: (path: string, content: string) => void | Promise<void>;
  move_file?: (from: string, to: string) => void | Promise<void>;
  file_exists?: (path: string) => boolean;
};
const overrides: Override = {};

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
          if (overrides.file_exists) return overrides.file_exists(a.path ?? "");
          return fs.has(a.path ?? "");
        case "read_file":
          if (overrides.read_file) return await overrides.read_file(a.path ?? "");
          {
            const v = fs.get(a.path ?? "");
            if (v === undefined) throw new Error(`ENOENT: ${a.path}`);
            return v;
          }
        case "write_file":
          if (overrides.write_file)
            return await overrides.write_file(a.path ?? "", a.content ?? "");
          fs.set(a.path ?? "", a.content ?? "");
          return undefined;
        case "move_file":
          if (overrides.move_file)
            return await overrides.move_file(a.from ?? "", a.to ?? "");
          {
            const v = fs.get(a.from ?? "");
            if (v === undefined) throw new Error(`ENOENT: ${a.from}`);
            fs.set(a.to ?? "", v);
            fs.delete(a.from ?? "");
          }
          return undefined;
        case "ensure_dir":
          return undefined;
        case "delete_file":
          fs.delete(a.path ?? "");
          return undefined;
        case "list_files":
          return [];
        default:
          return undefined;
      }
    },
  ),
}));

import { invoke as mockedInvoke } from "@tauri-apps/api/core";
import { z } from "zod";

import { toast } from "../components/shared/Toast";
import { freezeClock, thawClock } from "../test/clock";
import {
  __resetDataDirCacheForTests,
  ensureDataDir,
  fileExists,
  getCommandsPath,
  getDataDir,
  getDataPath,
  JsonReadError,
  readJsonFile,
  readJsonFileOrCreate,
  writeJsonFile,
} from "./file-io";

const Schema = z.object({ a: z.number() });
const PATH = "/data/test.json";

beforeEach(() => {
  fs.clear();
  (Object.keys(overrides) as (keyof Override)[]).forEach((k) => {
    delete overrides[k];
  });
  __resetDataDirCacheForTests();
  vi.mocked(mockedInvoke).mockClear();
  vi.mocked(toast.error).mockClear();
  vi.mocked(toast.success).mockClear();
  // Pin Date so the backup filename timestamp is assertable.
  freezeClock();
  // The recovery path logs to console.error on failure; keep the test
  // output clean. restoreAllMocks in afterEach undoes this.
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  thawClock();
  vi.restoreAllMocks();
});

describe("readJsonFile", () => {
  it("returns parsed data on happy path", async () => {
    fs.set(PATH, JSON.stringify({ a: 1 }));
    expect(await readJsonFile(PATH, Schema)).toEqual({ a: 1 });
  });

  it("wraps read_file failure into JsonReadError", async () => {
    overrides.read_file = () => {
      throw new Error("EACCES");
    };
    await expect(readJsonFile(PATH, Schema)).rejects.toBeInstanceOf(
      JsonReadError,
    );
    await expect(readJsonFile(PATH, Schema)).rejects.toMatchObject({
      path: PATH,
      message: expect.stringContaining("EACCES"),
    });
  });

  it("wraps invalid JSON into JsonReadError", async () => {
    fs.set(PATH, "{ not json");
    await expect(readJsonFile(PATH, Schema)).rejects.toMatchObject({
      path: PATH,
      message: expect.stringMatching(/Невалидный JSON/),
    });
  });

  it("schema mismatch surfaces field path", async () => {
    fs.set(PATH, JSON.stringify({ a: "wrong-type" }));
    await expect(readJsonFile(PATH, Schema)).rejects.toMatchObject({
      path: PATH,
      message: expect.stringMatching(/Валидация не прошла.*a:/),
    });
  });

  it("schema mismatch at root labels the issue (root)", async () => {
    fs.set(PATH, JSON.stringify("not-an-object"));
    await expect(readJsonFile(PATH, Schema)).rejects.toMatchObject({
      message: expect.stringContaining("(root)"),
    });
  });
});

describe("readJsonFileOrCreate", () => {
  it("creates the file with defaults when missing", async () => {
    expect(await readJsonFileOrCreate(PATH, Schema, { a: 0 })).toEqual({
      a: 0,
    });
    expect(fs.get(PATH)).toBe(JSON.stringify({ a: 0 }, null, 2));
  });

  it("returns parsed data when file is valid", async () => {
    fs.set(PATH, JSON.stringify({ a: 7 }));
    expect(await readJsonFileOrCreate(PATH, Schema, { a: 0 })).toEqual({
      a: 7,
    });
  });

  it("recovers via moveFile when JSON is broken", async () => {
    fs.set(PATH, "{ broken");
    const out = await readJsonFileOrCreate(PATH, Schema, { a: 0 });
    expect(out).toEqual({ a: 0 });
    const backup = [...fs.keys()].find((k) =>
      k.startsWith(`${PATH}.corrupted-`),
    );
    expect(backup).toBeDefined();
    expect(fs.get(backup!)).toBe("{ broken");
    expect(fs.get(PATH)).toBe(JSON.stringify({ a: 0 }, null, 2));
    expect(toast.error).toHaveBeenCalledWith(
      expect.stringMatching(/восстановлен пустой/),
    );
  });

  it("recovers via moveFile when schema is wrong", async () => {
    fs.set(PATH, JSON.stringify({ a: "wrong" }));
    await readJsonFileOrCreate(PATH, Schema, { a: 0 });
    const backup = [...fs.keys()].find((k) =>
      k.startsWith(`${PATH}.corrupted-`),
    );
    expect(backup).toBeDefined();
    expect(fs.get(backup!)).toBe(JSON.stringify({ a: "wrong" }));
  });

  it("backup filename includes a sanitized timestamp", async () => {
    fs.set(PATH, "{ broken");
    await readJsonFileOrCreate(PATH, Schema, { a: 0 });
    const backup = [...fs.keys()].find((k) =>
      k.startsWith(`${PATH}.corrupted-`),
    );
    // freezeClock pins to 2025-06-11T10:00:00.000Z; recovery replaces
    // `:` and `.` with `-`.
    expect(backup).toMatch(/\.corrupted-2025-06-11T10-00-00-000Z\.json$/);
  });

  it("falls back to content-write when moveFile fails", async () => {
    fs.set(PATH, "{ broken");
    overrides.move_file = () => {
      throw new Error("EXDEV: cross-device");
    };
    const out = await readJsonFileOrCreate(PATH, Schema, { a: 0 });
    expect(out).toEqual({ a: 0 });
    const backup = [...fs.keys()].find((k) =>
      k.startsWith(`${PATH}.corrupted-`),
    );
    expect(backup).toBeDefined();
    // moveFile failed → fallback wrote raw bytes via write_file.
    expect(fs.get(backup!)).toBe("{ broken");
    expect(fs.get(PATH)).toBe(JSON.stringify({ a: 0 }, null, 2));
  });

  it("refuses to overwrite when both backup paths fail", async () => {
    fs.set(PATH, "{ broken");
    overrides.move_file = () => {
      throw new Error("EXDEV");
    };
    // First read returns the broken content (via readJsonFile). Second
    // read is the recovery's raw-byte grab — make it fail so the
    // content-write fallback has nothing to persist.
    let reads = 0;
    overrides.read_file = () => {
      reads += 1;
      if (reads === 1) return "{ broken";
      throw new Error("EACCES");
    };
    await expect(
      readJsonFileOrCreate(PATH, Schema, { a: 0 }),
    ).rejects.toBeInstanceOf(JsonReadError);
    // Original untouched — refusing to overwrite is the whole point.
    expect(fs.get(PATH)).toBe("{ broken");
    expect(toast.error).toHaveBeenCalledWith(
      expect.stringMatching(/бэкап создать не удалось/),
    );
  });
});

describe("writeJsonFile", () => {
  it("pretty-prints JSON with 2-space indent", async () => {
    await writeJsonFile("/data/x.json", { a: 1, b: [2, 3] });
    expect(fs.get("/data/x.json")).toBe(
      JSON.stringify({ a: 1, b: [2, 3] }, null, 2),
    );
  });
});

describe("getDataDir", () => {
  it("caches the result; reset clears the cache", async () => {
    expect(await getDataDir()).toBe("/data");
    expect(await getDataDir()).toBe("/data");
    let calls = vi
      .mocked(mockedInvoke)
      .mock.calls.filter((c) => c[0] === "get_data_dir").length;
    expect(calls).toBe(1);

    __resetDataDirCacheForTests();
    await getDataDir();
    calls = vi
      .mocked(mockedInvoke)
      .mock.calls.filter((c) => c[0] === "get_data_dir").length;
    expect(calls).toBe(2);
  });
});

describe("path helpers", () => {
  it("getDataPath skips empty segments", async () => {
    expect(await getDataPath("a", "", "b")).toBe("/data/a/b");
  });

  it("getDataPath collapses double slashes", async () => {
    expect(await getDataPath("a/", "/b")).toBe("/data/a/b");
  });

  it("getCommandsPath roots at data/commands", async () => {
    expect(await getCommandsPath("pending", "x.json")).toBe(
      "/data/commands/pending/x.json",
    );
  });
});

describe("ensureDataDir", () => {
  it("creates the data root and all required subdirs in order", async () => {
    vi.mocked(mockedInvoke).mockClear();
    await ensureDataDir();
    const ensureCalls = vi
      .mocked(mockedInvoke)
      .mock.calls.filter((c) => c[0] === "ensure_dir")
      .map((c) => (c[1] as { path: string }).path);
    expect(ensureCalls).toEqual([
      "/data",
      "/data/schedule",
      "/data/pool",
      "/data/templates",
      "/data/dashboards",
      "/data/commands/pending",
      "/data/commands/done",
      "/data/commands/failed",
    ]);
  });
});

describe("fileExists", () => {
  it("reflects the underlying FS", async () => {
    expect(await fileExists("/data/y")).toBe(false);
    fs.set("/data/y", "ok");
    expect(await fileExists("/data/y")).toBe(true);
  });
});
