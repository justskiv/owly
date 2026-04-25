import { listen } from "@tauri-apps/api/event";
import { useDashboardStore } from "../store/dashboards";

interface DashboardChange {
  path: string;
  kind: "created" | "modified" | "removed";
}

let installed = false;
let debounce: number | null = null;

// Coalesce bursts. VS Code "save" can fire several events within
// a few ms (atomic write + index refresh); we collapse them into
// one reload at the end of a quiescent window. Cheap to be wrong
// here — extra reloads are imperceptible — so the upper bound is
// generous.
const DEBOUNCE_MS = 100;

// Listen for file changes inside data/dashboards/ emitted by the
// Rust watcher and refresh the registry + bump the active dashboard
// to recompile from disk. Idempotent; React StrictMode double-mount
// won't install twice.
export async function installDashboardHotReload(): Promise<void> {
  if (installed) return;
  installed = true;

  await listen<DashboardChange>("dashboard-files-changed", (e) => {
    const name = e.payload.path.split("/").pop() ?? "";
    if (name.startsWith(".tmp.")) return;
    if (name.startsWith(".")) return;
    const isJsx = name.endsWith(".jsx");
    const isRegistry = name === "_registry.json";
    if (!isJsx && !isRegistry) return;

    if (debounce !== null) window.clearTimeout(debounce);
    debounce = window.setTimeout(() => {
      void useDashboardStore.getState().loadRegistry();
      useDashboardStore.getState().bumpReload();
    }, DEBOUNCE_MS);
  });
}
