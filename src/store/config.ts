import { create } from "zustand";
import type { ConfigFile } from "../schemas";
import { ConfigFileSchema } from "../schemas";
import {
  getDataPath,
  readJsonFileOrCreate,
} from "../services/file-io";
import { DEFAULT_CONFIG } from "../services/defaults";

interface ConfigStore {
  config: ConfigFile | null;
  loading: boolean;
  error: string | null;
  loadConfig: () => Promise<void>;
}

export const useConfigStore = create<ConfigStore>((set) => ({
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
}));
