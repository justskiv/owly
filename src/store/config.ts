import { create } from "zustand";
import type { Area, ConfigFile, SchedulingPreferences } from "../schemas";
import { ConfigFileSchema } from "../schemas";
import {
  getDataPath,
  readJsonFileOrCreate,
  writeJsonFile,
} from "../services/file-io";
import { DEFAULT_CONFIG } from "../services/defaults";
import { trackSave } from "../services/save-status";

interface ConfigStore {
  config: ConfigFile | null;
  loading: boolean;
  error: string | null;
  loadConfig: () => Promise<void>;
  saveConfig: () => Promise<void>;
  setAreas: (areas: Area[]) => Promise<void>;
  setPipelineStages: (stages: string[]) => Promise<void>;
  setSchedulingPrefs: (prefs: SchedulingPreferences) => Promise<void>;
}

async function persistConfig(config: ConfigFile) {
  const path = await getDataPath("config.json");
  const parsed = ConfigFileSchema.safeParse(config);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`)
      .join("; ");
    throw new Error(`config.json save rejected: ${issues}`);
  }
  await writeJsonFile(path, parsed.data);
}

export const useConfigStore = create<ConfigStore>((set, get) => ({
  config: null,
  loading: false,
  error: null,

  loadConfig: async () => {
    set({ loading: true, error: null });
    try {
      const path = await getDataPath("config.json");
      const config = await readJsonFileOrCreate(
        path,
        ConfigFileSchema,
        DEFAULT_CONFIG,
      );
      set({ config, loading: false });
    } catch (e) {
      set({ error: (e as Error).message, loading: false });
      throw e;
    }
  },

  saveConfig: async () => {
    const cfg = get().config;
    if (!cfg) return;
    await trackSave(() => persistConfig(cfg));
  },

  // Set in-memory FIRST, then write. Rapid keystrokes in Settings
  // must each read the latest state — otherwise the next call pulls
  // a stale `cfg` from before the previous write finished and the
  // intermediate edit is lost. persistConfig re-validates so a
  // rejected shape surfaces via the save-status banner.
  setAreas: async (areas) => {
    const cfg = get().config;
    if (!cfg) return;
    const next: ConfigFile = { ...cfg, areas };
    set({ config: next });
    await trackSave(() => persistConfig(next));
  },

  setPipelineStages: async (stages) => {
    const cfg = get().config;
    if (!cfg) return;
    const next: ConfigFile = { ...cfg, pipeline_stages: stages };
    set({ config: next });
    await trackSave(() => persistConfig(next));
  },

  setSchedulingPrefs: async (scheduling_preferences) => {
    const cfg = get().config;
    if (!cfg) return;
    const next: ConfigFile = { ...cfg, scheduling_preferences };
    set({ config: next });
    await trackSave(() => persistConfig(next));
  },
}));
