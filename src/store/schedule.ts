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

// Monotonically increasing token; each loadWeek() snapshots the current
// value and bails on commit if a newer load has started since. Without
// this, two quick clicks on next-week can let week N's read finish
// after week N+2's set({currentWeek}), and writes go to the wrong file.
let loadToken = 0;

// Persist-first: write the file before mutating store. If the write
// throws, in-memory state still matches disk and the toast surfaces
// the failure; otherwise a silent state/disk drift bites on next reload.
async function persistWeek(
  snapshot: {
    currentWeek: string;
    startDate: string;
    templateApplied: string | null;
  },
  blocks: Block[],
) {
  const path = await getDataPath("schedule", `${snapshot.currentWeek}.json`);
  const file: WeekFile = {
    version: 1,
    week: snapshot.currentWeek,
    start_date: snapshot.startDate,
    template_applied: snapshot.templateApplied,
    blocks,
  };
  await writeJsonFile(path, file);
}

export const useScheduleStore = create<ScheduleStore>((set, get) => ({
  currentWeek: initialWeek,
  startDate: getWeekStartDate(initialWeek),
  templateApplied: null,
  blocks: [],
  loading: false,
  error: null,

  loadWeek: async (week) => {
    const myToken = ++loadToken;
    set({ loading: true, error: null, currentWeek: week });
    try {
      const path = await getDataPath("schedule", `${week}.json`);
      const startDate = getWeekStartDate(week);
      const data = await readJsonFileOrCreate(
        path,
        WeekFileSchema,
        emptyWeekFile(week, startDate),
      );
      if (myToken !== loadToken) return;
      set({
        startDate: data.start_date,
        templateApplied: data.template_applied,
        blocks: data.blocks,
        loading: false,
      });
    } catch (e) {
      if (myToken !== loadToken) return;
      set({ error: (e as Error).message, loading: false });
      throw e;
    }
  },

  saveWeek: async () => {
    const snap = get();
    await trackSave(() => persistWeek(snap, snap.blocks));
  },

  addBlock: async (draft) => {
    const block: Block = { ...draft, id: generateId("blk") };
    const snap = get();
    const next = [...snap.blocks, block];
    await trackSave(() => persistWeek(snap, next));
    set({ blocks: next });
    return block;
  },

  updateBlock: async (id, updates) => {
    const snap = get();
    const next = snap.blocks.map((b) =>
      b.id === id ? { ...b, ...updates } : b,
    );
    await trackSave(() => persistWeek(snap, next));
    set({ blocks: next });
  },

  moveBlock: async (id, date, start) => {
    await get().updateBlock(id, { date, start });
  },

  resizeBlock: async (id, duration) => {
    await get().updateBlock(id, { duration });
  },

  deleteBlock: async (id) => {
    const snap = get();
    const next = snap.blocks.filter((b) => b.id !== id);
    await trackSave(() => persistWeek(snap, next));
    set({ blocks: next });
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
