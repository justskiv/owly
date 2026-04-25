import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";
import type { DashboardEntry, DashboardRegistry } from "../schemas";
import { DashboardRegistrySchema } from "../schemas";
import {
  deleteFile,
  fileExists,
  getDataPath,
  readJsonFileOrCreate,
  writeJsonFile,
} from "../services/file-io";
import {
  BLANK_DASHBOARD_TEMPLATE,
  EMPTY_DASHBOARD_REGISTRY,
} from "../services/defaults";
import { trackSave } from "../services/save-status";

type LoadingState = "idle" | "loading" | "ready" | "error";

interface DashboardStore {
  registry: DashboardEntry[];
  loadingState: LoadingState;
  registryError: string | null;

  // Bumps to force <DashboardHost> to re-read the .jsx from disk.
  // Increments on the user's "↻ Обновить" click.
  reloadToken: number;

  loadRegistry: () => Promise<void>;
  addDashboard: (input: {
    title: string;
    description?: string;
    icon?: string;
  }) => Promise<DashboardEntry>;
  renameDashboard: (id: string, title: string) => Promise<void>;
  deleteDashboard: (id: string) => Promise<void>;
  bumpReload: () => void;

  // Reads the raw .jsx text. Throws if the entry isn't in the
  // registry or the file is missing.
  readDashboardSource: (id: string) => Promise<string>;
}

async function persistRegistry(reg: DashboardEntry[]) {
  const path = await getDataPath("dashboards", "_registry.json");
  const file: DashboardRegistry = { version: 1, dashboards: reg };
  const parsed = DashboardRegistrySchema.safeParse(file);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`)
      .join("; ");
    throw new Error(`registry rejected: ${issues}`);
  }
  await writeJsonFile(path, parsed.data);
}

// Lightweight cyrillic → latin transliteration so a title like
// "Финансы" produces a meaningful slug ("finansy") instead of falling
// through to the generic "dashboard" placeholder.
const CYR_MAP: Record<string, string> = {
  а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "yo",
  ж: "zh", з: "z", и: "i", й: "y", к: "k", л: "l", м: "m",
  н: "n", о: "o", п: "p", р: "r", с: "s", т: "t", у: "u",
  ф: "f", х: "h", ц: "ts", ч: "ch", ш: "sh", щ: "sch",
  ъ: "", ы: "y", ь: "", э: "e", ю: "yu", я: "ya",
};

function transliterate(s: string): string {
  let out = "";
  for (const ch of s.toLowerCase()) {
    out += CYR_MAP[ch] ?? ch;
  }
  return out;
}

function slugify(s: string): string {
  return (
    transliterate(s)
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "dashboard"
  );
}

// Single in-flight queue. Every mutation routes through this so two
// rapid clicks (add → add, or rename mid-delete) don't read stale
// registry snapshots and clobber each other.
//
// Each step receives the LATEST registry from the store, computes the
// next state synchronously, persists to disk FIRST, and only then
// applies `set(...)`. If persistence throws, in-memory state stays
// consistent with what's actually on disk.
let mutationChain: Promise<unknown> = Promise.resolve();

function enqueue<T>(fn: () => Promise<T>): Promise<T> {
  const next = mutationChain.then(fn, fn);
  // Don't let one rejection block the chain — swallow here, the
  // returned promise still rejects to the caller.
  mutationChain = next.catch(() => undefined);
  return next;
}

export const useDashboardStore = create<DashboardStore>((set, get) => ({
  registry: [],
  loadingState: "idle",
  registryError: null,
  reloadToken: 0,

  loadRegistry: async () => {
    set({ loadingState: "loading", registryError: null });
    try {
      const path = await getDataPath("dashboards", "_registry.json");
      const file = await readJsonFileOrCreate(
        path,
        DashboardRegistrySchema,
        EMPTY_DASHBOARD_REGISTRY,
      );
      const sorted = [...file.dashboards].sort((a, b) => a.order - b.order);
      set({ registry: sorted, loadingState: "ready" });
    } catch (e) {
      set({
        registryError: (e as Error).message,
        loadingState: "error",
      });
      throw e;
    }
  },

  addDashboard: ({ title, description = "", icon = "📊" }) =>
    enqueue(async () => {
      const reg = get().registry;
      const baseId = slugify(title);
      let id = baseId;
      let n = 2;
      // Avoid id collision against both the registry and any orphan
      // .jsx left from a previous failed add.
      const dashDir = await getDataPath("dashboards");
      while (
        reg.some((d) => d.id === id) ||
        (await fileExists(`${dashDir}/${id}.jsx`))
      ) {
        id = `${baseId}-${n++}`;
      }
      const file = `${id}.jsx`;
      const filePath = await getDataPath("dashboards", file);

      const order =
        reg.length === 0 ? 1 : Math.max(...reg.map((d) => d.order)) + 1;
      const entry: DashboardEntry = {
        id,
        title,
        file,
        icon,
        order,
        description,
      };
      const next = [...reg, entry];

      // Persist BOTH side-effects before touching memory. If either
      // throws, in-memory registry is unchanged. The .jsx-then-registry
      // order is intentional: a stranded file is recoverable (the next
      // addDashboard with the same title will pick it up via the
      // collision check above), but a registry pointing at a missing
      // file would render as a broken card.
      await invoke("write_file", {
        path: filePath,
        content: BLANK_DASHBOARD_TEMPLATE,
      });
      try {
        await trackSave(() => persistRegistry(next));
      } catch (e) {
        // Roll back the file write so we don't leave an orphan.
        try {
          await deleteFile(filePath);
        } catch {
          /* best-effort cleanup */
        }
        throw e;
      }

      set({ registry: next });
      return entry;
    }),

  renameDashboard: (id, title) =>
    enqueue(async () => {
      const reg = get().registry;
      if (!reg.some((d) => d.id === id)) return;
      const next = reg.map((d) => (d.id === id ? { ...d, title } : d));
      await trackSave(() => persistRegistry(next));
      set({ registry: next });
    }),

  deleteDashboard: (id) =>
    enqueue(async () => {
      const reg = get().registry;
      const entry = reg.find((d) => d.id === id);
      if (!entry) return;
      const next = reg.filter((d) => d.id !== id);

      // Persist the registry FIRST. If it fails, the .jsx still exists
      // and the user can retry. The reverse order would leave us with
      // a registry referencing a now-missing file.
      await trackSave(() => persistRegistry(next));
      set({ registry: next });

      const filePath = await getDataPath("dashboards", entry.file);
      if (await fileExists(filePath)) {
        try {
          await deleteFile(filePath);
        } catch {
          // Registry is already updated; the orphan file will be
          // overwritten if the user creates a new dashboard with
          // the same title. Not worth surfacing.
        }
      }
    }),

  bumpReload: () => set((s) => ({ reloadToken: s.reloadToken + 1 })),

  readDashboardSource: async (id) => {
    const entry = get().registry.find((d) => d.id === id);
    if (!entry) throw new Error(`Dashboard not in registry: ${id}`);
    const path = await getDataPath("dashboards", entry.file);
    return await invoke<string>("read_file", { path });
  },
}));
