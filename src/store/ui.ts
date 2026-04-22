import { create } from "zustand";

export type Page = "planner" | "entities" | "dashboards";
export type SaveStatus = "idle" | "saving" | "saved" | "error";

interface UIStore {
  currentPage: Page;
  selectedEntityId: string | null;
  selectedBlockId: string | null;
  saveStatus: SaveStatus;
  saveError: string | null;
  savedAt: Date | null;

  setPage: (page: Page) => void;
  setSelectedEntity: (id: string | null) => void;
  setSelectedBlock: (id: string | null) => void;
  setSaveStatus: (status: SaveStatus, error?: string | null) => void;
}

export const useUIStore = create<UIStore>((set) => ({
  currentPage: "planner",
  selectedEntityId: null,
  selectedBlockId: null,
  saveStatus: "idle",
  saveError: null,
  savedAt: null,

  setPage: (currentPage) => set({ currentPage }),
  setSelectedEntity: (selectedEntityId) => set({ selectedEntityId }),
  setSelectedBlock: (selectedBlockId) => set({ selectedBlockId }),
  setSaveStatus: (saveStatus, saveError = null) =>
    set((prev) => ({
      saveStatus,
      saveError,
      savedAt: saveStatus === "saved" ? new Date() : prev.savedAt,
    })),
}));
