import { create } from "zustand";
import type { EntityType, Status } from "../schemas";
import { useConfigStore } from "./config";

export type Page =
  | "plan"
  | "tasks"
  | "projects"
  | "context"
  | "horizon"
  | "review"
  // Hidden debug entry points reached via Cmd+Shift+E / Cmd+Shift+D.
  // Their final fate is decided in Phase 9.
  | "entities"
  | "dashboards";
export type SaveStatus = "idle" | "saving" | "saved" | "error";
export type SettingsTab = "areas" | "template" | "pipeline" | "ai" | "data";

export type EntityEditorState =
  | { open: false }
  | { open: true; mode: "new"; type: EntityType }
  | { open: true; mode: "edit"; entityId: string };

export type DashboardEditorState =
  | { open: false }
  | { open: true; mode: "add" }
  | { open: true; mode: "rename"; id: string }
  | { open: true; mode: "delete"; id: string };

export type QAType = "task" | "project" | "direction";

export interface QuickAddState {
  open: boolean;
  type: QAType;
  category: string | null;
  // Remembered across opens so the next Quick Add prefills the last
  // user choice. In-memory only — on app restart this resets.
  lastCategory: string | null;
  // Frozen on open. Per spec §10.1 the hint stays stable when the
  // user toggles type, communicating "by-context" while still allowing
  // an override without UI churn.
  hintLabel: string;
}

export type EntityPopupAnchor =
  | { type: "rect"; rect: DOMRect }
  | { type: "point"; x: number; y: number };

export type EntityPopupState =
  | { open: false }
  | {
      open: true;
      entityId: string;
      anchor: EntityPopupAnchor;
      position: "below" | "right";
    };

const TYPE_BY_PAGE: Record<Page, QAType> = {
  plan: "task",
  tasks: "task",
  projects: "project",
  context: "direction",
  horizon: "project",
  review: "task",
  entities: "task",
  dashboards: "task",
};

const TYPE_LABEL_RU: Record<QAType, string> = {
  task: "Задача",
  project: "Проект",
  direction: "Направление",
};

interface UIStore {
  currentPage: Page;
  selectedEntityId: string | null;
  selectedBlockId: string | null;
  saveStatus: SaveStatus;
  saveError: string | null;
  savedAt: Date | null;
  // Monotonic counter incremented when an external trigger (menu bar)
  // requests a new block. PlannerPage subscribes and opens the editor.
  newBlockTrigger: number;
  poolCollapsed: boolean;

  // Entities page filters + search
  entityFilterType: EntityType | "all";
  entityFilterAreas: string[];
  entityFilterStatuses: Status[];
  entitySearch: string;

  // EntityEditor modal
  entityEditor: EntityEditorState;

  // Settings modal
  settingsOpen: boolean;
  settingsTab: SettingsTab;

  // Create dropdown (the "+ Создать" menu in EntitiesHeader)
  createDropdownOpen: boolean;

  // Pool carry-over section collapsed state
  carryOverCollapsed: boolean;

  // When user navigates to a week without a file, this holds that
  // week id and PlannerPage shows a dialog offering template/empty.
  weekPromptId: string | null;

  // Dashboard view state. selectedDashboardId === null means we're
  // on the grid; setting it to a registry id switches to the host
  // view that compiles and renders the corresponding .jsx.
  selectedDashboardId: string | null;
  dashboardEditor: DashboardEditorState;

  // CommandsLogPanel — opened from the executed/failed counters in
  // the status bar. Two tabs: "done" lists commands/done/ (read-only
  // log), "failed" lists commands/failed/ with retry/dismiss.
  commandsPanelOpen: boolean;
  commandsPanelTab: "done" | "failed";

  // Quick Add overlay (Cmd+N). Replaces the legacy EntityEditor "new"
  // path for the three primary types — task/project/direction. Other
  // types still go through the debug Cmd+Shift+E flow.
  quickAdd: QuickAddState;

  // Compact popup over an anchor (e.g., a planner block). Phase 2
  // ships only the skeleton; phases 3–5 fill it with type-specific
  // fields.
  entityPopup: EntityPopupState;

  setPage: (page: Page) => void;
  setSelectedEntity: (id: string | null) => void;
  setSelectedBlock: (id: string | null) => void;
  setSaveStatus: (status: SaveStatus, error?: string | null) => void;
  requestNewBlock: () => void;
  togglePool: () => void;

  setEntityFilterType: (t: EntityType | "all") => void;
  toggleEntityFilterArea: (area: string) => void;
  toggleEntityFilterStatus: (s: Status) => void;
  setEntitySearch: (q: string) => void;
  resetEntityFilters: () => void;

  openEntityEditorNew: (type: EntityType) => void;
  openEntityEditorEdit: (entityId: string) => void;
  closeEntityEditor: () => void;

  openSettings: (tab?: SettingsTab) => void;
  closeSettings: () => void;
  setSettingsTab: (tab: SettingsTab) => void;

  toggleCreateDropdown: () => void;
  closeCreateDropdown: () => void;

  toggleCarryOver: () => void;

  setWeekPrompt: (id: string | null) => void;

  setSelectedDashboard: (id: string | null) => void;
  openDashboardEditorAdd: () => void;
  openDashboardEditorRename: (id: string) => void;
  openDashboardEditorDelete: (id: string) => void;
  closeDashboardEditor: () => void;

  openCommandsPanel: (tab?: "done" | "failed") => void;
  closeCommandsPanel: () => void;
  setCommandsPanelTab: (tab: "done" | "failed") => void;

  openQuickAdd: (defaultType?: QAType) => void;
  closeQuickAdd: () => void;
  setQuickAddType: (t: QAType) => void;
  setQuickAddCategory: (cat: string) => void;

  openEntityPopup: (
    entityId: string,
    anchor: EntityPopupAnchor,
    position: "below" | "right",
  ) => void;
  closeEntityPopup: () => void;
}

export const useUIStore = create<UIStore>((set, get) => ({
  currentPage: "plan",
  selectedEntityId: null,
  selectedBlockId: null,
  saveStatus: "idle",
  saveError: null,
  savedAt: null,
  newBlockTrigger: 0,
  poolCollapsed: false,

  entityFilterType: "all",
  entityFilterAreas: [],
  entityFilterStatuses: ["active", "someday"],
  entitySearch: "",

  entityEditor: { open: false },

  settingsOpen: false,
  settingsTab: "areas",

  createDropdownOpen: false,
  carryOverCollapsed: true,
  weekPromptId: null,

  selectedDashboardId: null,
  dashboardEditor: { open: false },
  commandsPanelOpen: false,
  commandsPanelTab: "done",

  quickAdd: {
    open: false,
    type: "task",
    category: null,
    lastCategory: null,
    hintLabel: TYPE_LABEL_RU.task,
  },
  entityPopup: { open: false },

  setPage: (currentPage) => set({ currentPage }),
  setSelectedEntity: (selectedEntityId) => set({ selectedEntityId }),
  setSelectedBlock: (selectedBlockId) => set({ selectedBlockId }),
  setSaveStatus: (saveStatus, saveError = null) =>
    set((prev) => ({
      saveStatus,
      saveError,
      savedAt: saveStatus === "saved" ? new Date() : prev.savedAt,
    })),
  requestNewBlock: () =>
    set((prev) => ({ newBlockTrigger: prev.newBlockTrigger + 1 })),
  togglePool: () =>
    set((prev) => ({ poolCollapsed: !prev.poolCollapsed })),

  setEntityFilterType: (entityFilterType) => set({ entityFilterType }),
  toggleEntityFilterArea: (area) =>
    set((prev) => ({
      entityFilterAreas: prev.entityFilterAreas.includes(area)
        ? prev.entityFilterAreas.filter((x) => x !== area)
        : [...prev.entityFilterAreas, area],
    })),
  toggleEntityFilterStatus: (s) =>
    set((prev) => ({
      entityFilterStatuses: prev.entityFilterStatuses.includes(s)
        ? prev.entityFilterStatuses.filter((x) => x !== s)
        : [...prev.entityFilterStatuses, s],
    })),
  setEntitySearch: (entitySearch) => set({ entitySearch }),
  resetEntityFilters: () =>
    set({
      entityFilterType: "all",
      entityFilterAreas: [],
      entityFilterStatuses: ["active", "someday"],
      entitySearch: "",
    }),

  openEntityEditorNew: (type) =>
    set({ entityEditor: { open: true, mode: "new", type } }),
  openEntityEditorEdit: (entityId) =>
    set({ entityEditor: { open: true, mode: "edit", entityId } }),
  closeEntityEditor: () => set({ entityEditor: { open: false } }),

  openSettings: (tab) =>
    set((prev) => ({ settingsOpen: true, settingsTab: tab ?? prev.settingsTab })),
  closeSettings: () => set({ settingsOpen: false }),
  setSettingsTab: (settingsTab) => set({ settingsTab }),

  toggleCreateDropdown: () =>
    set((prev) => ({ createDropdownOpen: !prev.createDropdownOpen })),
  closeCreateDropdown: () => set({ createDropdownOpen: false }),

  toggleCarryOver: () =>
    set((prev) => ({ carryOverCollapsed: !prev.carryOverCollapsed })),

  setWeekPrompt: (weekPromptId) => set({ weekPromptId }),

  setSelectedDashboard: (selectedDashboardId) =>
    set({ selectedDashboardId }),
  openDashboardEditorAdd: () =>
    set({ dashboardEditor: { open: true, mode: "add" } }),
  openDashboardEditorRename: (id) =>
    set({ dashboardEditor: { open: true, mode: "rename", id } }),
  openDashboardEditorDelete: (id) =>
    set({ dashboardEditor: { open: true, mode: "delete", id } }),
  closeDashboardEditor: () => set({ dashboardEditor: { open: false } }),

  openCommandsPanel: (tab) =>
    set((prev) => ({
      commandsPanelOpen: true,
      commandsPanelTab: tab ?? prev.commandsPanelTab,
    })),
  closeCommandsPanel: () => set({ commandsPanelOpen: false }),
  setCommandsPanelTab: (commandsPanelTab) => set({ commandsPanelTab }),

  openQuickAdd: (defaultType) => {
    const page = get().currentPage;
    const type = defaultType ?? TYPE_BY_PAGE[page];
    const lastCategory = get().quickAdd.lastCategory;
    const cfg = useConfigStore.getState().config;
    const category = lastCategory ?? cfg?.areas[0]?.id ?? null;
    set({
      quickAdd: {
        open: true,
        type,
        category,
        lastCategory,
        hintLabel: TYPE_LABEL_RU[type],
      },
    });
  },
  closeQuickAdd: () =>
    set((s) => ({ quickAdd: { ...s.quickAdd, open: false } })),
  setQuickAddType: (t) =>
    set((s) => ({ quickAdd: { ...s.quickAdd, type: t } })),
  setQuickAddCategory: (cat) =>
    set((s) => ({
      quickAdd: { ...s.quickAdd, category: cat, lastCategory: cat },
    })),

  openEntityPopup: (entityId, anchor, position) =>
    set({ entityPopup: { open: true, entityId, anchor, position } }),
  closeEntityPopup: () => set({ entityPopup: { open: false } }),
}));
