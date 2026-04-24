import { create } from "zustand";
import type { Area, ConfigFile } from "../schemas";
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
}

async function persistConfig(config: ConfigFile) {
  const path = await getDataPath("config.json");
  await writeJsonFile(path, config);
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

  setAreas: async (areas) => {
    const cfg = get().config;
    if (!cfg) return;
    const next: ConfigFile = { ...cfg, areas };
    await trackSave(() => persistConfig(next));
    set({ config: next });
  },

  setPipelineStages: async (stages) => {
    const cfg = get().config;
    if (!cfg) return;
    const next: ConfigFile = { ...cfg, pipeline_stages: stages };
    await trackSave(() => persistConfig(next));
    set({ config: next });
  },
}));
