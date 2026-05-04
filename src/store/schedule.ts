import { create } from "zustand";
import type { Block, BlockStatus, WeekFile } from "../schemas";
import { WeekFileSchema } from "../schemas";
import {
  fileExists,
  getDataPath,
  listFiles,
  readJsonFile,
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
import { getCachedWeek, setCachedWeek } from "../services/week-cache";
import { enqueueWeekWrite } from "../services/week-write-queue";
import { useUIStore } from "./ui";

interface LoadWeekOptions {
  // When true, a missing week file is created empty silently; when
  // false, the store sets ui.weekPromptId so PlannerPage can show the
  // "template / empty" dialog. The initial app boot uses true so the
  // first-run experience shows an empty grid, not a modal.
  silentCreate?: boolean;
}

interface ScheduleStore {
  currentWeek: string;
  startDate: string;
  templateApplied: string | null;
  blocks: Block[];
  loading: boolean;
  error: string | null;

  loadWeek: (week: string, opts?: LoadWeekOptions) => Promise<void>;
  saveWeek: () => Promise<void>;

  addBlock: (
    block: Omit<Block, "id" | "pool_item_id"> & {
      id?: string;
      pool_item_id?: string | null;
    },
  ) => Promise<Block>;
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

type WeekSnapshot = {
  currentWeek: string;
  startDate: string;
  templateApplied: string | null;
};

// Eagerly mirror the optimistic in-memory blocks into the week-cache
// BEFORE notifying React subscribers. Stats consumers (RoutineDetail,
// carry-over) read through the cache; if we wait for persistWeek to
// push the validated copy, the React effect that fires from
// `set({blocks: next})` lands inside the same tick and reads the
// pre-edit cache → stats stay stale until the user re-selects the
// entity. persistWeek will overwrite this with the same shape on
// success, so no work is wasted.
function syncCache(snap: WeekSnapshot, blocks: Block[]) {
  setCachedWeek(snap.currentWeek, {
    version: 1,
    week: snap.currentWeek,
    start_date: snap.startDate,
    template_applied: snap.templateApplied,
    blocks,
  });
}

// Validate-then-write. We used to persist before updating in-memory
// state so a failed write couldn't leak stale data; the downside was
// that rapid mutations (two drag moves in a row, fast checklist
// toggles) pulled stale snapshots and lost updates. After review we
// flipped the order store-side and added Zod guarding here — a bad
// shape throws and the toast surfaces it, without ever hitting disk.
async function persistWeek(snapshot: WeekSnapshot, blocks: Block[]) {
  const path = await getDataPath("schedule", `${snapshot.currentWeek}.json`);
  const file: WeekFile = {
    version: 1,
    week: snapshot.currentWeek,
    start_date: snapshot.startDate,
    template_applied: snapshot.templateApplied,
    blocks,
  };
  const parsed = WeekFileSchema.safeParse(file);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`)
      .join("; ");
    throw new Error(`${snapshot.currentWeek}.json save rejected: ${issues}`);
  }
  await writeJsonFile(path, parsed.data);
  // Belt-and-braces: same shape, but now guaranteed to match disk
  // (defaults applied by Zod, etc.).
  setCachedWeek(snapshot.currentWeek, parsed.data);
}

export const useScheduleStore = create<ScheduleStore>((set, get) => ({
  currentWeek: initialWeek,
  startDate: getWeekStartDate(initialWeek),
  templateApplied: null,
  blocks: [],
  loading: false,
  error: null,

  loadWeek: async (week, opts) => {
    const silent = opts?.silentCreate ?? false;
    const myToken = ++loadToken;
    set({ loading: true, error: null, currentWeek: week });
    try {
      const path = await getDataPath("schedule", `${week}.json`);
      const startDate = getWeekStartDate(week);
      const exists = await fileExists(path);
      if (!exists && !silent) {
        // Defer creation until the user picks template vs empty. Until
        // then show a clean (empty) grid and raise the prompt.
        if (myToken !== loadToken) return;
        // Mark missing in the cache so carry-over / stats don't burn
        // an IPC call to re-confirm what we already know.
        setCachedWeek(week, null);
        set({
          startDate,
          templateApplied: null,
          blocks: [],
          loading: false,
        });
        useUIStore.getState().setWeekPrompt(week);
        return;
      }
      // Both branches go through readJsonFileOrCreate so a corrupt
      // existing file falls into the recovery path — `.corrupted-*`
      // backup + write defaults — rather than throwing and crashing
      // boot. Pool/entities/horizon already do this; closing the gap
      // here keeps a single corrupt schedule/<week>.json from
      // bricking the whole app on cold start.
      const data = await readJsonFileOrCreate(
        path,
        WeekFileSchema,
        emptyWeekFile(week, startDate),
      );
      if (myToken !== loadToken) return;
      // Cache the freshly-loaded week so the first routine click
      // doesn't re-read the same file off disk.
      setCachedWeek(week, data);
      set({
        startDate: data.start_date,
        templateApplied: data.template_applied,
        blocks: data.blocks,
        loading: false,
      });
      // Clear any stale prompt if a prior state had one.
      if (useUIStore.getState().weekPromptId) {
        useUIStore.getState().setWeekPrompt(null);
      }
    } catch (e) {
      if (myToken !== loadToken) return;
      set({ error: (e as Error).message, loading: false });
      throw e;
    }
  },

  saveWeek: async () => {
    const snap = get();
    await trackSave(() =>
      enqueueWeekWrite(snap.currentWeek, () => persistWeek(snap, snap.blocks)),
    );
  },

  addBlock: async (draft) => {
    const block: Block = {
      ...draft,
      id: draft.id ?? generateId("blk"),
      pool_item_id: draft.pool_item_id ?? null,
    };
    const snap = get();
    const next = [...snap.blocks, block];
    syncCache(snap, next);
    set({ blocks: next });
    await trackSave(() =>
      enqueueWeekWrite(snap.currentWeek, () => persistWeek(snap, next)),
    );
    return block;
  },

  updateBlock: async (id, updates) => {
    const snap = get();
    const next = snap.blocks.map((b) =>
      b.id === id ? { ...b, ...updates } : b,
    );
    syncCache(snap, next);
    set({ blocks: next });
    await trackSave(() =>
      enqueueWeekWrite(snap.currentWeek, () => persistWeek(snap, next)),
    );
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
    syncCache(snap, next);
    set({ blocks: next });
    await trackSave(() =>
      enqueueWeekWrite(snap.currentWeek, () => persistWeek(snap, next)),
    );
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

// Mutate any week's blocks. If the week is the active one, route
// through the store so the UI updates reactively. Otherwise read
// the file (via cache) and write directly through the per-week
// queue. Used by the command executor when the agent targets a
// week the user isn't currently viewing.
export async function applyToWeek(
  weekId: string,
  mutate: (blocks: Block[]) => Block[],
): Promise<void> {
  const store = useScheduleStore.getState();
  if (weekId === store.currentWeek) {
    const snap: WeekSnapshot = {
      currentWeek: store.currentWeek,
      startDate: store.startDate,
      templateApplied: store.templateApplied,
    };
    const next = mutate(store.blocks);
    syncCache(snap, next);
    useScheduleStore.setState({ blocks: next });
    await trackSave(() =>
      enqueueWeekWrite(weekId, () => persistWeek(snap, next)),
    );
    return;
  }

  // Read-modify-write must run inside the queue so two off-current
  // mutations don't both read the same starting file and clobber
  // each other. Mirrors `applyToPoolWeek` in pool-actions.ts:39-66.
  await trackSave(() =>
    enqueueWeekWrite(weekId, async () => {
      const path = await getDataPath("schedule", `${weekId}.json`);
      let file = await getCachedWeek(weekId);
      if (!file) {
        if (!(await fileExists(path))) {
          throw new Error(`Week ${weekId} does not exist; create_week first`);
        }
        file = await readJsonFile(path, WeekFileSchema);
        setCachedWeek(weekId, file);
      }
      const next = mutate(file.blocks);
      const snap: WeekSnapshot = {
        currentWeek: weekId,
        startDate: file.start_date,
        templateApplied: file.template_applied,
      };
      await persistWeek(snap, next);
    }),
  );
}

// Find which week a given block belongs to. Hot path: check the
// active week's in-memory blocks. Cold path: walk all schedule files
// on disk (via week-cache, which fronts disk reads). With a typical
// single-user history (dozens of weeks) the scan completes in a
// handful of milliseconds — acceptable for a fallback that runs at
// most once per agent command.
export async function findWeekContainingBlock(
  blockId: string,
): Promise<string | null> {
  const cur = useScheduleStore.getState();
  if (cur.blocks.some((b) => b.id === blockId)) return cur.currentWeek;

  const dir = await getDataPath("schedule");
  let names: string[] = [];
  try {
    names = await listFiles(dir);
  } catch {
    return null;
  }
  for (const name of names) {
    if (!name.endsWith(".json") || name.startsWith(".")) continue;
    const weekId = name.replace(/\.json$/, "");
    const file = await getCachedWeek(weekId);
    if (file && file.blocks.some((b) => b.id === blockId)) return weekId;
  }
  return null;
}

// Look up a single block on a known week. Used by cross-week
// move_block to capture the source row before mutation, so the
// destination can receive an exact copy.
export async function findBlockById(
  weekId: string,
  blockId: string,
): Promise<Block | null> {
  const store = useScheduleStore.getState();
  if (weekId === store.currentWeek) {
    return store.blocks.find((b) => b.id === blockId) ?? null;
  }
  const file = await getCachedWeek(weekId);
  return file?.blocks.find((b) => b.id === blockId) ?? null;
}
