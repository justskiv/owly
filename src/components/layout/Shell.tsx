import { useEffect } from "react";
import { Header } from "./Header";
import { Sidebar } from "./Sidebar";
import { StatusBar } from "./StatusBar";
import { Toast } from "../shared/Toast";
import { PlannerPage } from "../../pages/PlannerPage";
import { EntitiesPage } from "../../pages/EntitiesPage";
import { DashboardsPage } from "../../pages/DashboardsPage";
import { useUIStore, type Page } from "../../store/ui";

const KEY_PAGE: Record<string, Page> = {
  Digit1: "planner",
  Digit2: "entities",
  Digit3: "dashboards",
};

export function Shell() {
  const setPage = useUIStore((s) => s.setPage);

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
      const next = KEY_PAGE[e.code];
      if (next) setPage(next);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [setPage]);

  return (
    <div className="app" onContextMenu={(e) => e.preventDefault()}>
      <Sidebar />
      <Header />
      <main className="main">
        <PlannerPage />
        <EntitiesPage />
        <DashboardsPage />
      </main>
      <StatusBar />
      <Toast />
    </div>
  );
}
