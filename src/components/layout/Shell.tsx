import { useEffect } from "react";
import { Header } from "./Header";
import { StatusBar } from "./StatusBar";
import { TopNav } from "./TopNav";
import { Toast } from "../shared/Toast";
import { PlannerPage } from "../../pages/PlannerPage";
import { TasksPage } from "../../pages/TasksPage";
import { ProjectsPage } from "../../pages/ProjectsPage";
import { ContextPage } from "../../pages/ContextPage";
import { HorizonPage } from "../../pages/HorizonPage";
import { ReviewPage } from "../../pages/ReviewPage";
import { EntitiesPage } from "../../pages/EntitiesPage";
import { DashboardsPage } from "../../pages/DashboardsPage";
import { EntityEditor } from "../entities/EntityEditor";
import { SettingsModal } from "../settings/SettingsModal";
import { CommandsLogPanel } from "../commands/CommandsLogPanel";
import { QuickAdd } from "../quick-add/QuickAdd";
import { EntityPopupHost } from "../shared/EntityPopup";
import { useUIStore, type Page } from "../../store/ui";

const KEY_PAGE: Record<string, Page> = {
  Digit1: "plan",
  Digit2: "tasks",
  Digit3: "projects",
  Digit4: "context",
  Digit5: "horizon",
  Digit6: "review",
};

export function Shell() {
  const currentPage = useUIStore((s) => s.currentPage);
  const setPage = useUIStore((s) => s.setPage);
  const entityEditor = useUIStore((s) => s.entityEditor);
  const settingsOpen = useUIStore((s) => s.settingsOpen);
  const commandsPanelOpen = useUIStore((s) => s.commandsPanelOpen);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as Element | null;
      const isEditable =
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        (target as HTMLElement | null)?.isContentEditable;

      // Tab over controls is browser behavior; native macOS apps
      // don't focus buttons via Tab by default. All in-app
      // navigation goes through hotkeys. Tab still works inside
      // form fields and inside modals (focus-trap handles it).
      if (e.key === "Tab" && !isEditable) {
        const insideDialog = (target as HTMLElement | null)?.closest(
          '[role="dialog"]',
        );
        if (!insideDialog) {
          e.preventDefault();
          return;
        }
      }

      if (isEditable) return;

      // Cmd+Shift+E / Cmd+Shift+D — debug entry points to the legacy
      // screens. Kept while phases 1..8 are in flight; Phase 9 decides
      // their final fate.
      if (e.metaKey && e.shiftKey && !e.altKey) {
        if (e.code === "KeyE") {
          e.preventDefault();
          setPage("entities");
          return;
        }
        if (e.code === "KeyD") {
          e.preventDefault();
          setPage("dashboards");
          return;
        }
      }

      // Cmd+N / Ctrl+N — toggle Quick Add. The Tauri menu sends the
      // same accelerator via emit("menu", "new-block"); duplicate
      // firing is benign because both paths land on the same toggle.
      if (
        (e.metaKey || e.ctrlKey) &&
        !e.shiftKey &&
        !e.altKey &&
        e.code === "KeyN"
      ) {
        e.preventDefault();
        const ui = useUIStore.getState();
        if (ui.quickAdd.open) ui.closeQuickAdd();
        else ui.openQuickAdd();
        return;
      }

      // Digits 1..6 without modifiers — switch main tabs.
      if (e.metaKey || e.ctrlKey || e.altKey || e.shiftKey) return;
      const next = KEY_PAGE[e.code];
      if (next) setPage(next);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [setPage]);

  const isDebugPage =
    currentPage === "entities" || currentPage === "dashboards";

  return (
    <div className="app" onContextMenu={(e) => e.preventDefault()}>
      <TopNav />
      {isDebugPage && <Header />}
      <main className="main">
        {currentPage === "plan" && <PlannerPage />}
        {currentPage === "tasks" && <TasksPage />}
        {currentPage === "projects" && <ProjectsPage />}
        {currentPage === "context" && <ContextPage />}
        {currentPage === "horizon" && <HorizonPage />}
        {currentPage === "review" && <ReviewPage />}
        {currentPage === "entities" && <EntitiesPage />}
        {currentPage === "dashboards" && <DashboardsPage />}
      </main>
      <StatusBar />
      <Toast />
      <QuickAdd />
      <EntityPopupHost />
      {entityEditor.open && <EntityEditor state={entityEditor} />}
      {settingsOpen && <SettingsModal />}
      {commandsPanelOpen && <CommandsLogPanel />}
    </div>
  );
}
