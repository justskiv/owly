import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// command-processor's public test handles gate behind __APP_MODE__.
(globalThis as { __APP_MODE__?: string }).__APP_MODE__ = "test";

vi.mock("../components/shared/Toast", () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

// vi.hoisted lifts these above the hoisted vi.mock factories so they
// are initialized before any import resolves through the mocks.
const { storeSpies, executorSpies } = vi.hoisted(() => ({
  // useCommandStore.getState() must return the same object across
  // calls so assertions see the same spy.
  storeSpies: {
    bumpExecuted: vi.fn(),
    addDone: vi.fn(),
    addFailed: vi.fn(),
  },
  executorSpies: {
    executeCommand: vi.fn(async () => undefined),
    // Explicit return type so mockReturnValueOnce({...}) typechecks —
    // an inferred `() => undefined` would lock the spy's return.
    batchPartialOf: vi.fn<
      (
        e: unknown,
      ) => { succeeded: number; failed_at_index: number } | undefined
    >(() => undefined),
  },
}));

vi.mock("../store/commands", () => ({
  useCommandStore: { getState: () => storeSpies },
}));

vi.mock("./command-executor", () => executorSpies);

const fs = new Map<string, string>();
type Override = {
  read_file?: (path: string, callCount: number) => string | Promise<string>;
  move_file?: (from: string, to: string) => void | Promise<void>;
  delete_file?: (path: string) => void | Promise<void>;
};
const overrides: Override = {};
let readCount = 0;

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
        case "read_file":
          readCount += 1;
          if (overrides.read_file)
            return await overrides.read_file(a.path ?? "", readCount);
          {
            const v = fs.get(a.path ?? "");
            if (v === undefined) throw new Error(`ENOENT: ${a.path}`);
            return v;
          }
        case "write_file":
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
        case "delete_file":
          if (overrides.delete_file)
            return await overrides.delete_file(a.path ?? "");
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
import { toast } from "../components/shared/Toast";
import { __resetDataDirCacheForTests } from "./file-io";
import {
  __processOnePendingForTests,
  __resetCommandProcessorForTests,
} from "./command-processor";

const PENDING = "/data/commands/pending/cmd-1.json";
const DONE = "/data/commands/done/cmd-1.json";
const FAILED = "/data/commands/failed/cmd-1.json";

const validCommand = {
  id: "cmd-1",
  action: "create_block",
  timestamp: "2025-06-11T10:00:00",
  data: {
    title: "T",
    date: "2025-06-11",
    start: "10:00",
    duration: 30,
    category: "work",
    source_entity_id: null,
  },
};

beforeEach(async () => {
  fs.clear();
  (Object.keys(overrides) as (keyof Override)[]).forEach((k) => {
    delete overrides[k];
  });
  readCount = 0;
  __resetDataDirCacheForTests();
  await __resetCommandProcessorForTests();
  storeSpies.bumpExecuted.mockClear();
  storeSpies.addDone.mockClear();
  storeSpies.addFailed.mockClear();
  executorSpies.executeCommand.mockClear();
  executorSpies.executeCommand.mockResolvedValue(undefined);
  executorSpies.batchPartialOf.mockClear();
  executorSpies.batchPartialOf.mockReturnValue(undefined);
  vi.mocked(toast.error).mockClear();
  vi.mocked(toast.success).mockClear();
  freezeClock();
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  thawClock();
  vi.restoreAllMocks();
});

describe("happy path", () => {
  it("executes, moves to done/, bumps store, toasts success", async () => {
    fs.set(PENDING, JSON.stringify(validCommand));
    await __processOnePendingForTests(PENDING);

    expect(executorSpies.executeCommand).toHaveBeenCalledTimes(1);
    expect(fs.has(PENDING)).toBe(false);
    expect(fs.has(DONE)).toBe(true);
    expect(storeSpies.bumpExecuted).toHaveBeenCalledTimes(1);
    expect(storeSpies.addDone).toHaveBeenCalledWith(DONE);
    expect(toast.success).toHaveBeenCalledWith(
      expect.stringContaining("Блок создан"),
    );
  });
});

describe("duplicate watcher event", () => {
  it("silently skips when the file is already gone", async () => {
    // First run moved the file; the second event for the same path
    // arrives after. processOne must noop, not fail.
    await __processOnePendingForTests(PENDING);

    expect(executorSpies.executeCommand).not.toHaveBeenCalled();
    expect(storeSpies.bumpExecuted).not.toHaveBeenCalled();
    expect(storeSpies.addFailed).not.toHaveBeenCalled();
    expect(toast.error).not.toHaveBeenCalled();
  });
});

describe("parse retry", () => {
  it("retries once and succeeds when the first read was truncated", async () => {
    fs.set(PENDING, JSON.stringify(validCommand));
    overrides.read_file = (path, n) => {
      if (n === 1) return JSON.stringify(validCommand).slice(0, 10);
      return fs.get(path) ?? "";
    };

    await __processOnePendingForTests(PENDING);

    expect(executorSpies.executeCommand).toHaveBeenCalledTimes(1);
    expect(fs.has(DONE)).toBe(true);
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("routes to failed/ when both parse attempts fail", async () => {
    fs.set(PENDING, "{ garbage");

    await __processOnePendingForTests(PENDING);

    expect(executorSpies.executeCommand).not.toHaveBeenCalled();
    expect(fs.has(PENDING)).toBe(false);
    expect(fs.has(FAILED)).toBe(true);
    const written = JSON.parse(fs.get(FAILED)!);
    expect(written.error).toMatch(/Read\/parse failed/);
    expect(storeSpies.addFailed).toHaveBeenCalledWith(FAILED);
    expect(toast.error).toHaveBeenCalled();
  });
});

describe("schema validation", () => {
  it("routes to failed/ with issues when schema rejects", async () => {
    fs.set(
      PENDING,
      JSON.stringify({ id: "cmd-1", action: "unknown_action" }),
    );

    await __processOnePendingForTests(PENDING);

    expect(executorSpies.executeCommand).not.toHaveBeenCalled();
    expect(fs.has(FAILED)).toBe(true);
    const written = JSON.parse(fs.get(FAILED)!);
    expect(written.error).toMatch(/Schema rejected/);
    expect(storeSpies.addFailed).toHaveBeenCalledWith(FAILED);
  });

  it("falls back to 'unknown' action in failed snapshot when action is non-string", async () => {
    fs.set(PENDING, JSON.stringify({ id: "cmd-1", action: 42 }));

    await __processOnePendingForTests(PENDING);

    expect(fs.has(FAILED)).toBe(true);
    const written = JSON.parse(fs.get(FAILED)!);
    expect(written.action).toBe("unknown");
  });
});

describe("executor failure", () => {
  it("routes to failed/ with error message when executeCommand throws", async () => {
    fs.set(PENDING, JSON.stringify(validCommand));
    executorSpies.executeCommand.mockRejectedValueOnce(
      new Error("downstream boom"),
    );

    await __processOnePendingForTests(PENDING);

    expect(fs.has(FAILED)).toBe(true);
    const written = JSON.parse(fs.get(FAILED)!);
    expect(written.error).toBe("downstream boom");
    expect(written.partial).toBeUndefined();
    expect(toast.error).toHaveBeenCalledWith(
      expect.stringContaining("create_block"),
    );
  });

  it("includes partial info when batchPartialOf returns one", async () => {
    fs.set(PENDING, JSON.stringify(validCommand));
    executorSpies.executeCommand.mockRejectedValueOnce(
      new Error("partial fail"),
    );
    executorSpies.batchPartialOf.mockReturnValueOnce({
      succeeded: 2,
      failed_at_index: 3,
    });

    await __processOnePendingForTests(PENDING);

    expect(fs.has(FAILED)).toBe(true);
    const written = JSON.parse(fs.get(FAILED)!);
    expect(written.partial).toEqual({ succeeded: 2, failed_at_index: 3 });
  });
});

describe("markDone fallback", () => {
  it("deletes source when move_file fails — no duplicate-exec risk", async () => {
    fs.set(PENDING, JSON.stringify(validCommand));
    overrides.move_file = () => {
      throw new Error("EBUSY");
    };

    await __processOnePendingForTests(PENDING);

    expect(executorSpies.executeCommand).toHaveBeenCalledTimes(1);
    // Source gone — boot drain won't re-execute the command.
    expect(fs.has(PENDING)).toBe(false);
    // No done file recorded — return null short-circuits addDone.
    expect(fs.has(DONE)).toBe(false);
    expect(storeSpies.bumpExecuted).toHaveBeenCalledTimes(1);
    expect(storeSpies.addDone).not.toHaveBeenCalled();
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("toasts manual-cleanup instructions when both move and delete fail", async () => {
    fs.set(PENDING, JSON.stringify(validCommand));
    overrides.move_file = () => {
      throw new Error("EBUSY");
    };
    overrides.delete_file = () => {
      throw new Error("EACCES");
    };

    await __processOnePendingForTests(PENDING);

    expect(executorSpies.executeCommand).toHaveBeenCalledTimes(1);
    // Source still in pending — user has to clean up manually so the
    // next boot drain doesn't re-execute.
    expect(fs.has(PENDING)).toBe(true);
    expect(toast.error).toHaveBeenCalledWith(
      expect.stringContaining("удалите вручную"),
    );
  });
});
