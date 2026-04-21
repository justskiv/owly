import { create } from "zustand";
import type { Block, BlockStatus, WeekFile } from "../schemas";
import { WeekFileSchema } from "../schemas";
import {
  getDataPath,
  readJsonFileOrCreate,
  writeJsonFile,
} from "../services/file-io";
import { emptyWeekFile } from "../services/defaults";
import {
  addWeeks,
  generateId,
  getCurrentWeekId,
  getWeekStartDate,
} from "../services/time-utils";
import { trackSave } from "../services/save-status";

interface ScheduleStore {
  currentWeek: string;
  startDate: string;
  templateApplied: string | null;
  blocks: Block[];
  loading: boolean;
  error: string | null;

  loadWeek: (week: string) => Promise<void>;
  saveWeek: () => Promise<void>;

  addBlock: (block: Omit<Block, "id">) => Promise<Block>;
  updateBlock: (id: string, updates: Partial<Block>) => Promise<void>;
  moveBlock: (id: string, date: string, start: string) => Promise<void>;
  resizeBlock: (id: string, duration: number) => Promise<void>;
  deleteBlock: (id: string) => Promise<void>;
  setBlockStatus: (id: string, status: BlockStatus) => Promise<void>;

  goToNextWeek: () => Promise<void>;
  goToPrevWeek: () => Promise<void>;
  goToCurrentWeek: () => Promise<void>;
}

const initialWeek = getCurrentWeekId();

export const useScheduleStore = create<ScheduleStore>((set, get) => ({
  currentWeek: initialWeek,
  startDate: getWeekStartDate(initialWeek),
  templateApplied: null,
  blocks: [],
  loading: false,
  error: null,

  loadWeek: async (week) => {
    set({ loading: true, error: null, currentWeek: week });
    try {
      const path = await getDataPath("schedule", `${week}.json`);
      const startDate = getWeekStartDate(week);
      const data = await readJsonFileOrCreate(
        path,
        WeekFileSchema,
        emptyWeekFile(week, startDate),
      );
      set({
        startDate: data.start_date,
        templateApplied: data.template_applied,
        blocks: data.blocks,
        loading: false,
      });
    } catch (e) {
      set({ error: (e as Error).message, loading: false });
      throw e;
    }
  },

  saveWeek: async () => {
    await trackSave(async () => {
      const { currentWeek, startDate, templateApplied, blocks } = get();
      const path = await getDataPath("schedule", `${currentWeek}.json`);
      const file: WeekFile = {
        version: 1,
        week: currentWeek,
        start_date: startDate,
        template_applied: templateApplied,
        blocks,
      };
      await writeJsonFile(path, file);
    });
  },

  addBlock: async (draft) => {
    const block: Block = { ...draft, id: generateId("blk") };
    set({ blocks: [...get().blocks, block] });
    await get().saveWeek();
    return block;
  },

  updateBlock: async (id, updates) => {
    set({
      blocks: get().blocks.map((b) =>
        b.id === id ? { ...b, ...updates } : b,
      ),
    });
    await get().saveWeek();
  },

  moveBlock: async (id, date, start) => {
    await get().updateBlock(id, { date, start });
  },

  resizeBlock: async (id, duration) => {
    await get().updateBlock(id, { duration });
  },

  deleteBlock: async (id) => {
    set({ blocks: get().blocks.filter((b) => b.id !== id) });
    await get().saveWeek();
  },

  setBlockStatus: async (id, status) => {
    await get().updateBlock(id, { status });
  },

  goToNextWeek: async () => {
    await get().loadWeek(addWeeks(get().currentWeek, 1));
  },
  goToPrevWeek: async () => {
    await get().loadWeek(addWeeks(get().currentWeek, -1));
  },
  goToCurrentWeek: async () => {
    await get().loadWeek(getCurrentWeekId());
  },
}));
