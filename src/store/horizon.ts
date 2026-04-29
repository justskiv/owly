import { create } from "zustand";
import type {
  HorizonFile,
  HorizonProjectState,
  HorizonSize,
} from "../schemas";
import { HorizonFileSchema } from "../schemas";
import {
  getDataPath,
  readJsonFileOrCreate,
  writeJsonFile,
} from "../services/file-io";
import { trackSave } from "../services/save-status";

// First day of the current month, formatted as YYYY-MM-DD. Used as the
// default `base_month` when no horizon.json exists yet, so a fresh
// install in any month/year doesn't anchor the horizon to a stale year.
function currentMonthFirstDay(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}-01`;
}

function emptyHorizonFile(): HorizonFile {
  return HorizonFileSchema.parse({
    version: 1,
    base_month: currentMonthFirstDay(),
    projects: [],
  });
}

// Mutators below set in-memory FIRST, then persist via trackSave. See
// entities.ts:117-119 for the rationale (rapid sequential mutations
// would otherwise pull stale snapshots and lose intermediate updates).
// pool.ts uses the same ordering.
async function persistHorizon(
  baseMonth: string,
  projects: HorizonProjectState[],
  groupCollapsed: HorizonFile["group_collapsed"],
  sectionCollapsed: HorizonFile["section_collapsed"],
): Promise<void> {
  const path = await getDataPath("horizon.json");
  const file: HorizonFile = {
    version: 1,
    base_month: baseMonth,
    projects,
    group_collapsed: groupCollapsed,
    section_collapsed: sectionCollapsed,
  };
  const parsed = HorizonFileSchema.safeParse(file);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`)
      .join("; ");
    throw new Error(`horizon.json save rejected: ${issues}`);
  }
  await writeJsonFile(path, parsed.data);
}

interface HorizonStore {
  baseMonth: string;
  projects: HorizonProjectState[];
  groupCollapsed: HorizonFile["group_collapsed"];
  sectionCollapsed: HorizonFile["section_collapsed"];
  loading: boolean;
  error: string | null;

  load: () => Promise<void>;
  setMonths: (projectId: string, months: number[]) => Promise<void>;
  setHidden: (projectId: string, hidden: boolean) => Promise<void>;
  setSize: (projectId: string, size: HorizonSize) => Promise<void>;
  toggleGroup: (group: HorizonSize) => Promise<void>;
  toggleSection: (
    section: "active" | "someday" | "deferred",
  ) => Promise<void>;
  addProject: (
    projectId: string,
    opts?: { size?: HorizonSize },
  ) => Promise<void>;
  removeProject: (projectId: string) => Promise<void>;
}

export const useHorizonStore = create<HorizonStore>((set, get) => {
  // Returns the current state shape used by every mutator before it
  // composes the persist payload. Avoids repeating the snapshot
  // construction in each setter.
  function snapshot(): {
    baseMonth: string;
    projects: HorizonProjectState[];
    groupCollapsed: HorizonFile["group_collapsed"];
    sectionCollapsed: HorizonFile["section_collapsed"];
  } {
    const s = get();
    return {
      baseMonth: s.baseMonth,
      projects: s.projects,
      groupCollapsed: s.groupCollapsed,
      sectionCollapsed: s.sectionCollapsed,
    };
  }

  async function persist(
    next: ReturnType<typeof snapshot>,
  ): Promise<void> {
    await persistHorizon(
      next.baseMonth,
      next.projects,
      next.groupCollapsed,
      next.sectionCollapsed,
    );
  }

  const initialEmpty = emptyHorizonFile();
  return {
    baseMonth: initialEmpty.base_month,
    projects: [],
    groupCollapsed: initialEmpty.group_collapsed,
    sectionCollapsed: initialEmpty.section_collapsed,
    loading: false,
    error: null,

    load: async () => {
      set({ loading: true, error: null });
      try {
        const path = await getDataPath("horizon.json");
        const file = await readJsonFileOrCreate(
          path,
          HorizonFileSchema,
          emptyHorizonFile(),
        );
        set({
          baseMonth: file.base_month,
          projects: file.projects,
          groupCollapsed: file.group_collapsed,
          sectionCollapsed: file.section_collapsed,
          loading: false,
        });
      } catch (e) {
        set({ error: (e as Error).message, loading: false });
        throw e;
      }
    },

    setMonths: async (projectId, months) => {
      const projects = get().projects.map((p) =>
        p.project_id === projectId ? { ...p, months } : p,
      );
      set({ projects });
      await trackSave(() => persist({ ...snapshot(), projects }));
    },

    setHidden: async (projectId, hidden) => {
      const projects = get().projects.map((p) =>
        p.project_id === projectId ? { ...p, hidden } : p,
      );
      set({ projects });
      await trackSave(() => persist({ ...snapshot(), projects }));
    },

    setSize: async (projectId, size) => {
      const projects = get().projects.map((p) =>
        p.project_id === projectId ? { ...p, size } : p,
      );
      set({ projects });
      await trackSave(() => persist({ ...snapshot(), projects }));
    },

    toggleGroup: async (group) => {
      const groupCollapsed = {
        ...get().groupCollapsed,
        [group]: !get().groupCollapsed[group],
      };
      set({ groupCollapsed });
      await trackSave(() => persist({ ...snapshot(), groupCollapsed }));
    },

    toggleSection: async (section) => {
      const sectionCollapsed = {
        ...get().sectionCollapsed,
        [section]: !get().sectionCollapsed[section],
      };
      set({ sectionCollapsed });
      await trackSave(() => persist({ ...snapshot(), sectionCollapsed }));
    },

    addProject: async (projectId, opts) => {
      if (get().projects.some((p) => p.project_id === projectId)) return;
      const next: HorizonProjectState = {
        project_id: projectId,
        months: [],
        size: opts?.size ?? "mid",
        hidden: false,
      };
      const projects = [...get().projects, next];
      set({ projects });
      await trackSave(() => persist({ ...snapshot(), projects }));
    },

    removeProject: async (projectId) => {
      const projects = get().projects.filter(
        (p) => p.project_id !== projectId,
      );
      set({ projects });
      await trackSave(() => persist({ ...snapshot(), projects }));
    },
  };
});
