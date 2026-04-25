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

function slugify(s: string): string {
  return (
    s
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "dashboard"
  );
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

  addDashboard: async ({ title, description = "", icon = "📊" }) => {
    const reg = get().registry;
    const baseId = slugify(title);
    let id = baseId;
    let n = 2;
    while (reg.some((d) => d.id === id)) {
      id = `${baseId}-${n++}`;
    }
    const file = `${id}.jsx`;
    const filePath = await getDataPath("dashboards", file);

    // Write the template first; if it fails we don't want a registry
    // entry pointing at a missing file.
    await invoke("write_file", {
      path: filePath,
      content: BLANK_DASHBOARD_TEMPLATE,
    });

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
    set({ registry: next });
    await trackSave(() => persistRegistry(next));
    return entry;
  },

  renameDashboard: async (id, title) => {
    const next = get().registry.map((d) =>
      d.id === id ? { ...d, title } : d,
    );
    set({ registry: next });
    await trackSave(() => persistRegistry(next));
  },

  deleteDashboard: async (id) => {
    const reg = get().registry;
    const entry = reg.find((d) => d.id === id);
    if (!entry) return;
    const filePath = await getDataPath("dashboards", entry.file);
    if (await fileExists(filePath)) {
      try {
        await deleteFile(filePath);
      } catch {
        // file already gone — registry cleanup still proceeds
      }
    }
    const next = reg.filter((d) => d.id !== id);
    set({ registry: next });
    await trackSave(() => persistRegistry(next));
  },

  bumpReload: () => set((s) => ({ reloadToken: s.reloadToken + 1 })),

  readDashboardSource: async (id) => {
    const entry = get().registry.find((d) => d.id === id);
    if (!entry) throw new Error(`Dashboard not in registry: ${id}`);
    const path = await getDataPath("dashboards", entry.file);
    return await invoke<string>("read_file", { path });
  },
}));
