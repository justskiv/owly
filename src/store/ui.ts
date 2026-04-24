import { create } from "zustand";
import type { EntityType, Status } from "../schemas";

export type Page = "planner" | "entities" | "dashboards";
export type SaveStatus = "idle" | "saving" | "saved" | "error";
export type SettingsTab = "areas" | "template" | "pipeline" | "data";

export type EntityEditorState =
  | { open: false }
  | { open: true; mode: "new"; type: EntityType }
  | { open: true; mode: "edit"; entityId: string };

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
}

export const useUIStore = create<UIStore>((set) => ({
  currentPage: "planner",
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
}));
