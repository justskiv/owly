import { create } from "zustand";
import type { EntityType, Status } from "../schemas";
import { useConfigStore } from "./config";
import { now } from "../services/clock";
import { tokenize, type Token } from "../services/quick-add-tokenizer";
import { buildPopoverItems } from "../services/quick-add-popover-items";
import { formatDate, getStartOfDay } from "../services/time-utils";
import type { BoardId } from "../services/boards";

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
  input: string;
  tokens: Token[];
  // Spans of date-modifier tokens the user explicitly clicked off.
  // Stored as "start-end" strings; the entry survives only while the
  // input span is unchanged (setQuickAddInput resets the set).
  deactivatedSpans: string[];
  popoverOpen: boolean;
  popoverFilter: string;
  popoverSelectedIndex: number;
  pickerOpen: boolean;
  pickerSelectedDate: string | null;
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

// Phase 6: ad-hoc blocks (no source_entity_id) get their own popup —
// EntityPopup only knows about entity ids, so we keep block-id state
// in a separate slot to avoid overloading the entity union.
export type BlockPopupState =
  | { open: false }
  | {
      open: true;
      blockId: string;
      anchor: EntityPopupAnchor;
      position: "below" | "right";
    };

export type SideTab = "pool" | "tasks" | "projects" | "dirs";
export type PoolModal = null | "new-task" | "new-pool-item";

// Phase 7: cross-highlight between Backlog items and board project rows.
// Hover sets a temporary highlight (`fixed: false`); click on a backlog
// item promotes it to fixed. Clicking the same item again or clicking
// empty board area clears it.
export type HorizonHighlight = { projectId: string; fixed: boolean } | null;

// Phase 8: which review period is active. Volatile, no persist —
// matches activeBoard / sideTab. We deliberately do NOT reset it in
// setPage so a user who switched to «Год», navigated away, and came
// back lands on the same tab.
export type ReviewPeriod = "week" | "month" | "year";

export type TaskStatusFilter = "overdue" | "week" | "done";
export type TaskPrioFilter = "high" | "medium" | "low";

// Three independent filter slots. AND across slots; each slot toggles
// on/off as a single value (clicking the same row again clears it).
export interface TaskFilters {
  status: TaskStatusFilter | null;
  cat: string | null;
  prio: TaskPrioFilter | null;
}

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

const EMPTY_QUICK_ADD: Omit<QuickAddState, "type" | "category" | "lastCategory"> = {
  open: false,
  input: "",
  tokens: [],
  deactivatedSpans: [],
  popoverOpen: false,
  popoverFilter: "",
  popoverSelectedIndex: 0,
  pickerOpen: false,
  pickerSelectedDate: null,
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

  // Quick Add overlay (Cmd+N). Spotlight-style command palette for
  // the three primary types — task/project/direction. Other types
  // still go through the debug Cmd+Shift+E flow.
  quickAdd: QuickAddState;

  // Compact popup over an anchor (e.g., a planner block). Phase 2
  // ships only the skeleton; phases 3–5 fill it with type-specific
  // fields.
  entityPopup: EntityPopupState;

  // Tasks page state (Phase 3). `taskAddCat` is null until the first
  // render of TasksPage, which initialises it from config.areas — at
  // store-construction time the config store is still loading.
  taskAddCat: string | null;
  taskSearch: string;
  taskFilter: TaskFilters;

  // Most recently created task. Highlighted in TasksPage so a fresh
  // task is easy to spot in a long list. Cleared on hover, on page
  // change, or when a newer task is created.
  lastCreatedTaskId: string | null;

  // Projects page state (Phase 4). All ephemeral — no persist.
  activeBoard: BoardId;
  catFilter: string | null;
  staleFilter: boolean;

  // Context page state (Phase 5). Default {} = all sections expanded.
  contextCollapsed: Record<string, boolean>;

  // Phase 6: Pool Sidebar active tab + Pool Add modal kind.
  sideTab: SideTab;
  poolModalOpen: PoolModal;
  blockPopup: BlockPopupState;

  // Phase 7: cross-highlight (board ↔ backlog). Volatile, no persist.
  horizonHighlight: HorizonHighlight;

  // Phase 8: active period tab on the Review screen.
  rvPeriod: ReviewPeriod;

  // Boot gate: subscriptions that mirror one store into another
  // (entity → horizon, schedule → pool) suspend their callbacks
  // until the initial Promise.all of loadConfig/loadEntities/
  // loadSchedule/loadPool/loadHorizon has completed AND reconcile
  // has run. Otherwise the diff between the empty initial snapshot
  // and the freshly-loaded state would fire spurious addProject /
  // loadWeek calls against half-hydrated stores. Subscriptions are
  // *installed* immediately so post-boot mutations are seen — but
  // their callbacks no-op until this flag flips true. See App.tsx
  // boot effect (R3 ловушка in spec/.../r1/phases/01-easy-critical.md).
  bootReady: boolean;

  setPage: (page: Page) => void;
  setHorizonHighlight: (h: HorizonHighlight) => void;
  setRvPeriod: (p: ReviewPeriod) => void;
  setSelectedEntity: (id: string | null) => void;
  setSelectedBlock: (id: string | null) => void;
  setSaveStatus: (status: SaveStatus, error?: string | null) => void;
  setBootReady: (ready: boolean) => void;
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
  setQuickAddInput: (input: string) => void;
  toggleTokenActive: (span: string) => void;
  openPopover: (filter?: string) => void;
  closePopover: () => void;
  setPopoverFilter: (filter: string) => void;
  setPopoverSelectedIndex: (i: number) => void;
  applyPopoverItem: () => void;
  openPicker: () => void;
  closePicker: () => void;
  setPickerSelectedDate: (iso: string | null) => void;
  applyPickerDate: () => void;

  openEntityPopup: (
    entityId: string,
    anchor: EntityPopupAnchor,
    position: "below" | "right",
  ) => void;
  closeEntityPopup: () => void;

  setTaskAddCat: (cat: string | null) => void;
  setTaskSearch: (q: string) => void;
  setTaskFilterStatus: (s: TaskStatusFilter | null) => void;
  setTaskFilterCat: (c: string | null) => void;
  setTaskFilterPrio: (p: TaskPrioFilter | null) => void;
  clearTaskFilters: () => void;
  setLastCreatedTask: (id: string | null) => void;

  setActiveBoard: (id: BoardId) => void;
  setCatFilter: (val: string | null) => void;
  toggleStaleFilter: () => void;

  toggleContextSection: (areaId: string) => void;

  setSideTab: (t: SideTab) => void;
  openPoolModal: (kind: Exclude<PoolModal, null>) => void;
  closePoolModal: () => void;
  openBlockPopup: (
    blockId: string,
    anchor: EntityPopupAnchor,
    position: "below" | "right",
  ) => void;
  closeBlockPopup: () => void;
}

// Carry user's deactivation choices over to the new tokenization. We
// match by `raw` text and ordinal within tokens with that raw — typing
// one extra letter must not silently re-activate a modifier the user
// just clicked off.
function migrateDeactivated(
  oldTokens: Token[],
  oldDeactivated: string[],
  newTokens: Token[],
): string[] {
  if (oldDeactivated.length === 0) return [];
  const descriptors: Array<{ raw: string; ordinal: number }> = [];
  for (const span of oldDeactivated) {
    const idx = oldTokens.findIndex((t) => `${t.start}-${t.end}` === span);
    if (idx < 0) continue;
    const tok = oldTokens[idx];
    const ordinal = oldTokens
      .slice(0, idx)
      .filter((t) => t.raw === tok.raw).length;
    descriptors.push({ raw: tok.raw, ordinal });
  }
  const result: string[] = [];
  for (const d of descriptors) {
    let count = 0;
    for (const t of newTokens) {
      if (t.raw !== d.raw) continue;
      if (count === d.ordinal) {
        result.push(`${t.start}-${t.end}`);
        break;
      }
      count++;
    }
  }
  return result;
}

function replaceLastBangFragment(input: string, replacement: string): string {
  // Replaces "!<filter>" up to the next whitespace (or end) with
  // `replacement`. Used when applying a popover item or picker date.
  const lastBang = input.lastIndexOf("!");
  if (lastBang === -1) {
    const sep = input === "" || input.endsWith(" ") ? "" : " ";
    return input + sep + replacement;
  }
  const before = input.slice(0, lastBang);
  const after = input.slice(lastBang);
  const wsIdx = after.search(/\s/);
  const tail = wsIdx === -1 ? "" : after.slice(wsIdx);
  return before + replacement + tail;
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
    ...EMPTY_QUICK_ADD,
    type: "task",
    category: null,
    lastCategory: null,
  },
  entityPopup: { open: false },

  taskAddCat: null,
  taskSearch: "",
  taskFilter: { status: null, cat: null, prio: null },
  lastCreatedTaskId: null,

  activeBoard: "brd1",
  catFilter: null,
  staleFilter: false,

  contextCollapsed: {},

  sideTab: "pool",
  poolModalOpen: null,
  blockPopup: { open: false },

  horizonHighlight: null,

  rvPeriod: "week",

  bootReady: false,

  // When we navigate away from the Horizon page, the cross-highlight
  // becomes orphan UI state that lights up nothing visible — clear it
  // here rather than via a useEffect cleanup, which would run after
  // the next page mounts (causing a brief flicker).
  setPage: (currentPage) =>
    set((prev) => ({
      currentPage,
      horizonHighlight:
        currentPage === "horizon" ? prev.horizonHighlight : null,
      lastCreatedTaskId: null,
    })),
  setHorizonHighlight: (horizonHighlight) => set({ horizonHighlight }),
  setRvPeriod: (rvPeriod) => set({ rvPeriod }),
  setSelectedEntity: (selectedEntityId) => set({ selectedEntityId }),
  setSelectedBlock: (selectedBlockId) => set({ selectedBlockId }),
  setSaveStatus: (saveStatus, saveError = null) =>
    set((prev) => ({
      saveStatus,
      saveError,
      savedAt: saveStatus === "saved" ? now() : prev.savedAt,
    })),
  setBootReady: (bootReady) => set({ bootReady }),
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
        ...EMPTY_QUICK_ADD,
        open: true,
        type,
        category,
        lastCategory,
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
  setQuickAddInput: (input) =>
    set((s) => {
      const newTokens = tokenize(input);
      return {
        quickAdd: {
          ...s.quickAdd,
          input,
          tokens: newTokens,
          deactivatedSpans: migrateDeactivated(
            s.quickAdd.tokens,
            s.quickAdd.deactivatedSpans,
            newTokens,
          ),
        },
      };
    }),
  toggleTokenActive: (span) =>
    set((s) => ({
      quickAdd: {
        ...s.quickAdd,
        deactivatedSpans: s.quickAdd.deactivatedSpans.includes(span)
          ? s.quickAdd.deactivatedSpans.filter((x) => x !== span)
          : [...s.quickAdd.deactivatedSpans, span],
      },
    })),
  openPopover: (filter = "") =>
    set((s) => ({
      quickAdd: {
        ...s.quickAdd,
        popoverOpen: true,
        popoverFilter: filter,
        popoverSelectedIndex: 0,
        pickerOpen: false,
      },
    })),
  closePopover: () =>
    set((s) => ({
      quickAdd: {
        ...s.quickAdd,
        popoverOpen: false,
        popoverFilter: "",
        popoverSelectedIndex: 0,
      },
    })),
  setPopoverFilter: (filter) =>
    set((s) => ({
      quickAdd: { ...s.quickAdd, popoverFilter: filter, popoverSelectedIndex: 0 },
    })),
  setPopoverSelectedIndex: (i) =>
    set((s) => ({ quickAdd: { ...s.quickAdd, popoverSelectedIndex: i } })),
  applyPopoverItem: () => {
    const { popoverFilter, popoverSelectedIndex, input } = get().quickAdd;
    const items = buildPopoverItems(popoverFilter);
    const item = items[popoverSelectedIndex];
    if (!item) return;
    if (item.isAction === "open-picker") {
      set((s) => ({
        quickAdd: {
          ...s.quickAdd,
          popoverOpen: false,
          popoverFilter: "",
          pickerOpen: true,
          pickerSelectedDate: null,
        },
      }));
      return;
    }
    const newInput = replaceLastBangFragment(input, item.apply);
    set((s) => ({
      quickAdd: {
        ...s.quickAdd,
        input: newInput,
        tokens: tokenize(newInput),
        deactivatedSpans: [],
        popoverOpen: false,
        popoverFilter: "",
        popoverSelectedIndex: 0,
      },
    }));
  },
  openPicker: () =>
    set((s) => ({
      quickAdd: {
        ...s.quickAdd,
        pickerOpen: true,
        pickerSelectedDate:
          s.quickAdd.pickerSelectedDate ?? formatDate(getStartOfDay()),
        popoverOpen: false,
        popoverFilter: "",
      },
    })),
  closePicker: () =>
    set((s) => ({
      quickAdd: {
        ...s.quickAdd,
        pickerOpen: false,
        pickerSelectedDate: null,
      },
    })),
  setPickerSelectedDate: (iso) =>
    set((s) => ({
      quickAdd: { ...s.quickAdd, pickerSelectedDate: iso },
    })),
  applyPickerDate: () => {
    const { input, pickerSelectedDate } = get().quickAdd;
    if (!pickerSelectedDate) return;
    const fragment = `!${pickerSelectedDate}`;
    const newInput = replaceLastBangFragment(input, fragment);
    set((s) => ({
      quickAdd: {
        ...s.quickAdd,
        input: newInput,
        tokens: tokenize(newInput),
        deactivatedSpans: [],
        pickerOpen: false,
        pickerSelectedDate: null,
      },
    }));
  },

  openEntityPopup: (entityId, anchor, position) =>
    set({ entityPopup: { open: true, entityId, anchor, position } }),
  closeEntityPopup: () => set({ entityPopup: { open: false } }),

  setTaskAddCat: (taskAddCat) => set({ taskAddCat }),
  setTaskSearch: (taskSearch) => set({ taskSearch }),
  setTaskFilterStatus: (status) =>
    set((s) => ({ taskFilter: { ...s.taskFilter, status } })),
  setTaskFilterCat: (cat) =>
    set((s) => ({ taskFilter: { ...s.taskFilter, cat } })),
  setTaskFilterPrio: (prio) =>
    set((s) => ({ taskFilter: { ...s.taskFilter, prio } })),
  clearTaskFilters: () =>
    set({ taskFilter: { status: null, cat: null, prio: null } }),
  setLastCreatedTask: (lastCreatedTaskId) => set({ lastCreatedTaskId }),

  // Switching board or category resets staleFilter; toggling stale
  // resets catFilter. The mock (renderProjects in pool-planner-demo-v2)
  // does the same so the active filter is always exactly one selection.
  setActiveBoard: (activeBoard) => set({ activeBoard, staleFilter: false }),
  setCatFilter: (catFilter) => set({ catFilter, staleFilter: false }),
  toggleStaleFilter: () =>
    set((prev) => ({ staleFilter: !prev.staleFilter, catFilter: null })),

  toggleContextSection: (areaId) =>
    set((prev) => ({
      contextCollapsed: {
        ...prev.contextCollapsed,
        [areaId]: !prev.contextCollapsed[areaId],
      },
    })),

  setSideTab: (sideTab) => set({ sideTab }),
  openPoolModal: (kind) => set({ poolModalOpen: kind }),
  closePoolModal: () => set({ poolModalOpen: null }),
  openBlockPopup: (blockId, anchor, position) =>
    set({ blockPopup: { open: true, blockId, anchor, position } }),
  closeBlockPopup: () => set({ blockPopup: { open: false } }),
}));
