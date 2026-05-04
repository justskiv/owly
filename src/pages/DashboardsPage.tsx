// Kept as a debug entry per Phase 9 D2 (spec §7-A) — v1 dashboard
// system stays available via Cmd+Shift+D, off the v2 top nav.
import { useCallback, useEffect } from "react";
import { useEscape } from "../hooks/useEscape";
import { useDashboardStore } from "../store/dashboards";
import { useUIStore } from "../store/ui";
import { AddDashboardCard } from "../components/dashboards/AddDashboardCard";
import { AddDashboardModal } from "../components/dashboards/AddDashboardModal";
import { ConfirmDeleteDashboard } from "../components/dashboards/ConfirmDeleteDashboard";
import { DashboardCard } from "../components/dashboards/DashboardCard";
import { DashboardHost } from "../components/dashboards/DashboardHost";
import { RenameDashboardModal } from "../components/dashboards/RenameDashboardModal";

export function DashboardsPage() {
  const active = useUIStore((s) => s.currentPage === "dashboards");
  const selectedId = useUIStore((s) => s.selectedDashboardId);
  const editor = useUIStore((s) => s.dashboardEditor);
  const setSelected = useUIStore((s) => s.setSelectedDashboard);

  // Escape returns to grid when a dashboard is open and no modal is
  // covering it. Modals install their own Escape handler that just
  // closes the modal — both are window listeners, so the editor.open
  // gate is what keeps them from firing together.
  const onEscape = useCallback(() => setSelected(null), [setSelected]);
  useEscape(onEscape, active && !!selectedId && !editor.open);

  return (
    <div className={`page${active ? " active" : ""}`}>
      {selectedId ? <DashboardHost id={selectedId} /> : <DashboardGrid />}
      {editor.open && editor.mode === "add" && <AddDashboardModal />}
      {editor.open && editor.mode === "rename" && (
        <RenameDashboardModal id={editor.id} />
      )}
      {editor.open && editor.mode === "delete" && (
        <ConfirmDeleteDashboard id={editor.id} />
      )}
    </div>
  );
}

function DashboardGrid() {
  const registry = useDashboardStore((s) => s.registry);
  const loadingState = useDashboardStore((s) => s.loadingState);
  const loadRegistry = useDashboardStore((s) => s.loadRegistry);
  const setSelected = useUIStore((s) => s.setSelectedDashboard);
  const openAdd = useUIStore((s) => s.openDashboardEditorAdd);
  const openRename = useUIStore((s) => s.openDashboardEditorRename);
  const openDelete = useUIStore((s) => s.openDashboardEditorDelete);

  // Re-read the registry whenever the user returns to the grid. Cheap
  // (one JSON file) and picks up any external edits the user made
  // through their editor or via an AI agent.
  useEffect(() => {
    void loadRegistry();
  }, [loadRegistry]);

  if (loadingState === "loading" && registry.length === 0) {
    return (
      <div className="dash-grid">
        <div className="dash-empty">Загрузка...</div>
      </div>
    );
  }

  return (
    <div className="dash-grid">
      {registry.map((d) => (
        <DashboardCard
          key={d.id}
          entry={d}
          onOpen={() => setSelected(d.id)}
          onRename={() => openRename(d.id)}
          onDelete={() => openDelete(d.id)}
        />
      ))}
      <AddDashboardCard onClick={openAdd} />
    </div>
  );
}
