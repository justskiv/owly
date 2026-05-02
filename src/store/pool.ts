import { create } from "zustand";
import type { PoolFile, PoolItem } from "../schemas";
import { PoolFileSchema } from "../schemas";
import {
  getDataPath,
  readJsonFileOrCreate,
  writeJsonFile,
} from "../services/file-io";
import { trackSave } from "../services/save-status";
import { enqueuePoolWrite } from "../services/pool-write-queue";
import { generateId, getCurrentWeekId, nowISO } from "../services/time-utils";

type PoolItemDraft = Omit<PoolItem, "id" | "created_at" | "updated_at"> & {
  id?: string;
  created_at?: string;
  updated_at?: string;
};

// Monotonically increasing token; each loadWeek() snapshots the current
// value and bails on commit if a newer load started since. Without this,
// two quick week switches can let an older read finish last and clobber
// state for a different week. Mirrors schedule.ts:61.
let loadToken = 0;

// Mutators below set in-memory FIRST, then persist via trackSave. This
// matches the prior-art pattern in entities.ts:117-119: a failed write
// throws and the toast surfaces it, while in-memory state stays
// consistent with what the user sees. Strict "persist first, then set"
// would lose intermediate updates under rapid mutations (two drags, a
// fast click sequence), which is why entities.ts flipped the order.
async function persistPool(week: string, items: PoolItem[]): Promise<void> {
  const path = await getDataPath("pool", `${week}.json`);
  const file: PoolFile = { version: 1, week, items };
  const parsed = PoolFileSchema.safeParse(file);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`)
      .join("; ");
    throw new Error(`pool/${week}.json save rejected: ${issues}`);
  }
  await writeJsonFile(path, parsed.data);
}

interface PoolStore {
  currentWeek: string;
  items: PoolItem[];
  loading: boolean;
  error: string | null;

  loadWeek: (week: string) => Promise<void>;
  addItem: (draft: PoolItemDraft) => Promise<PoolItem>;
  updateItem: (id: string, updates: Partial<PoolItem>) => Promise<void>;
  removeItem: (id: string) => Promise<void>;
  setPlaced: (id: string, placed: boolean) => Promise<void>;
}

export const usePoolStore = create<PoolStore>((set, get) => ({
  currentWeek: getCurrentWeekId(),
  items: [],
  loading: false,
  error: null,

  loadWeek: async (week) => {
    const myToken = ++loadToken;
    set({ loading: true, error: null, currentWeek: week });
    try {
      const path = await getDataPath("pool", `${week}.json`);
      const empty: PoolFile = { version: 1, week, items: [] };
      const file = await readJsonFileOrCreate(path, PoolFileSchema, empty);
      if (myToken !== loadToken) return;
      set({ items: file.items, loading: false });
    } catch (e) {
      if (myToken !== loadToken) return;
      set({ error: (e as Error).message, loading: false });
      throw e;
    }
  },

  addItem: async (draft) => {
    const now = nowISO();
    const item: PoolItem = {
      ...draft,
      id: draft.id ?? generateId("pool"),
      created_at: draft.created_at ?? now,
      updated_at: draft.updated_at ?? now,
    };
    // Snapshot the week at action time so a concurrent loadWeek
    // doesn't redirect the persist to a different file. Same pattern
    // as schedule.ts addBlock/updateBlock.
    const week = get().currentWeek;
    const next = [...get().items, item];
    set({ items: next });
    await trackSave(() =>
      enqueuePoolWrite(week, () => persistPool(week, next)),
    );
    return item;
  },

  updateItem: async (id, updates) => {
    const week = get().currentWeek;
    const next = get().items.map((it) =>
      it.id === id ? { ...it, ...updates, updated_at: nowISO() } : it,
    );
    set({ items: next });
    await trackSave(() =>
      enqueuePoolWrite(week, () => persistPool(week, next)),
    );
  },

  removeItem: async (id) => {
    const week = get().currentWeek;
    const next = get().items.filter((it) => it.id !== id);
    set({ items: next });
    await trackSave(() =>
      enqueuePoolWrite(week, () => persistPool(week, next)),
    );
  },

  setPlaced: async (id, placed) => {
    await get().updateItem(id, { placed });
  },
}));
