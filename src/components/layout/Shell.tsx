import { useEffect } from "react";
import { Header } from "./Header";
import { StatusBar } from "./StatusBar";
import { TopNav } from "./TopNav";
import { Toast } from "../shared/Toast";
import { PlannerPage } from "../../pages/PlannerPage";
import { TasksPage } from "../../pages/TasksPage";
import { ArchivePage } from "../../pages/ArchivePage";
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
import { BlockPopupHost } from "../planner/BlockPopup";
import { useUIStore } from "../../store/ui";

export function Shell() {
  const currentPage = useUIStore((s) => s.currentPage);
  const setPage = useUIStore((s) => s.setPage);
  const tasksView = useUIStore((s) => s.tasksView);
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

      // Cmd+Shift+E / Cmd+Shift+D — debug entry points to legacy
      // EntitiesPage / DashboardsPage. Kept per Phase 9 D1/D2 (the
      // spec defaults) so v1 entity types and dashboards stay
      // accessible without cluttering the v2 top nav.
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
        {currentPage === "tasks" && tasksView === "active" && <TasksPage />}
        {currentPage === "tasks" && tasksView === "archive" && <ArchivePage />}
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
      <BlockPopupHost />
      {entityEditor.open && <EntityEditor state={entityEditor} />}
      {settingsOpen && <SettingsModal />}
      {commandsPanelOpen && <CommandsLogPanel />}
    </div>
  );
}
