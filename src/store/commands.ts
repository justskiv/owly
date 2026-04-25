import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";
import {
  deleteFile,
  fileExists,
  getCommandsPath,
  listFiles,
  moveFile,
} from "../services/file-io";
import {
  DoneCommandFileSchema,
  FailedCommandFileSchema,
  type DoneCommandFile,
  type FailedCommandFile,
} from "../schemas";

export interface FailedRecord {
  // Absolute path on disk; doubles as a stable id for the panel.
  path: string;
  file: FailedCommandFile;
}

export interface DoneRecord {
  path: string;
  file: DoneCommandFile;
}

// Cap done/ list size in memory. Reading 10K JSON files on every
// panel open would block the UI; the log shows the most recent N.
// Older items are still on disk in commands/done/ for forensics.
const DONE_LIMIT = 200;

interface CommandStore {
  // Cleared on app start — the spec calls these "per session" counters.
  executed: number;
  failed: FailedRecord[];
  done: DoneRecord[];
  doneTruncated: boolean;

  bumpExecuted: () => void;
  loadFailed: () => Promise<void>;
  addFailed: (path: string) => Promise<void>;
  removeFailed: (path: string) => Promise<void>;
  retryFailed: (path: string) => Promise<void>;
  clearAllFailed: () => Promise<void>;
  loadDone: () => Promise<void>;
  addDone: (path: string) => Promise<void>;
  removeDone: (path: string) => Promise<void>;
  clearAllDone: () => Promise<void>;
}

async function readFailedOne(path: string): Promise<FailedRecord | null> {
  try {
    const text = await invoke<string>("read_file", { path });
    const raw = JSON.parse(text) as unknown;
    const parsed = FailedCommandFileSchema.safeParse(raw);
    if (!parsed.success) return null;
    return { path, file: parsed.data };
  } catch {
    return null;
  }
}

async function readDoneOne(path: string): Promise<DoneRecord | null> {
  try {
    const text = await invoke<string>("read_file", { path });
    const raw = JSON.parse(text) as unknown;
    const parsed = DoneCommandFileSchema.safeParse(raw);
    if (!parsed.success) return null;
    return { path, file: parsed.data };
  } catch {
    return null;
  }
}

export const useCommandStore = create<CommandStore>((set, get) => ({
  executed: 0,
  failed: [],
  done: [],
  doneTruncated: false,

  bumpExecuted: () => set((s) => ({ executed: s.executed + 1 })),

  loadFailed: async () => {
    const dir = await getCommandsPath("failed");
    let names: string[] = [];
    try {
      names = await listFiles(dir);
    } catch {
      return;
    }
    const records: FailedRecord[] = [];
    // Newest first — timestamp-prefixed names sort lexicographically
    // by time, so reverse alphabetical = newest at the top.
    for (const name of names.sort().reverse()) {
      if (!name.endsWith(".json") || name.startsWith(".")) continue;
      const path = await getCommandsPath("failed", name);
      const r = await readFailedOne(path);
      if (r) records.push(r);
    }
    set({ failed: records });
  },

  addFailed: async (path) => {
    const r = await readFailedOne(path);
    if (!r) return;
    set((s) => ({
      failed: [r, ...s.failed.filter((x) => x.path !== path)],
    }));
  },

  removeFailed: async (path) => {
    if (await fileExists(path)) {
      try {
        await deleteFile(path);
      } catch {
        // File already gone; treat as success.
      }
    }
    set((s) => ({ failed: s.failed.filter((x) => x.path !== path) }));
  },

  retryFailed: async (path) => {
    const name = path.split("/").pop();
    if (!name) return;
    const dest = await getCommandsPath("pending", name);
    await moveFile(path, dest);
    // The notify watcher will fire on the new file in pending/ →
    // command-processor enqueues a fresh attempt. Drop the failed
    // record optimistically; if it fails again the processor will
    // re-add it through addFailed.
    set((s) => ({ failed: s.failed.filter((x) => x.path !== path) }));
  },

  clearAllFailed: async () => {
    const list = get().failed;
    for (const r of list) {
      if (await fileExists(r.path)) {
        try {
          await deleteFile(r.path);
        } catch {
          // ignore
        }
      }
    }
    set({ failed: [] });
  },

  loadDone: async () => {
    const dir = await getCommandsPath("done");
    let names: string[] = [];
    try {
      names = await listFiles(dir);
    } catch {
      return;
    }
    const sorted = names
      .filter((n) => n.endsWith(".json") && !n.startsWith("."))
      .sort()
      .reverse();
    const slice = sorted.slice(0, DONE_LIMIT);
    const records: DoneRecord[] = [];
    for (const name of slice) {
      const path = await getCommandsPath("done", name);
      const r = await readDoneOne(path);
      if (r) records.push(r);
    }
    set({ done: records, doneTruncated: sorted.length > DONE_LIMIT });
  },

  addDone: async (path) => {
    const r = await readDoneOne(path);
    if (!r) return;
    set((s) => ({
      done: [r, ...s.done.filter((x) => x.path !== path)].slice(0, DONE_LIMIT),
    }));
  },

  removeDone: async (path) => {
    if (await fileExists(path)) {
      try {
        await deleteFile(path);
      } catch {
        // already gone
      }
    }
    set((s) => ({ done: s.done.filter((x) => x.path !== path) }));
  },

  clearAllDone: async () => {
    const list = get().done;
    for (const r of list) {
      if (await fileExists(r.path)) {
        try {
          await deleteFile(r.path);
        } catch {
          // ignore
        }
      }
    }
    set({ done: [], doneTruncated: false });
  },
}));
