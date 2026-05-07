import { useEffect } from "react";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { message } from "@tauri-apps/plugin-dialog";
import { exit } from "@tauri-apps/plugin-process";
import { Shell } from "./components/layout/Shell";
import { useConfigStore } from "./store/config";
import { useDashboardStore } from "./store/dashboards";
import { useEntityStore } from "./store/entities";
import { useHorizonStore } from "./store/horizon";
import { usePoolStore } from "./store/pool";
import { useScheduleStore } from "./store/schedule";
import { useUIStore } from "./store/ui";
import { ensureDataDir, JsonReadError } from "./services/file-io";
import { getCurrentWeekId } from "./services/time-utils";
import { startCommandProcessor } from "./services/command-processor";
import { installDashboardHotReload } from "./services/dashboard-hot-reload";
import { maybeMigrateToV2 } from "./services/seed-migration";
import { reconcile as reconcileHorizon } from "./services/horizon-reconcile";
import { errMsg } from "./services/format";

// Initial data loading. Exported so e2e tests can drive a real boot
// (Level 2: installFS + <App /> + advanceTimersByTimeAsync) without
// reaching into the App component's effect.
//
// - Seed migration runs BEFORE loadConfig — it reads config.json
//   directly via readJsonFile to validate seed areas, and may copy
//   seed-v2/* into data/ if entities.json is empty. The marker
//   .v2-migrated guarantees this runs exactly once.
// - Config must load first so entities can warn on unknown tags —
//   areas are passed in explicitly to keep the entity store free of
//   cross-store imports.
// - Watcher-driven processors only after stores are ready — a command
//   landing during boot would otherwise see empty snapshots.
export async function loadAll(
  opts?: { signal?: AbortSignal },
): Promise<void> {
  await ensureDataDir();
  await maybeMigrateToV2();
  if (opts?.signal?.aborted) return;
  await useConfigStore.getState().loadConfig();
  const areas = useConfigStore.getState().config?.areas;
  const currentWeek = getCurrentWeekId();
  await Promise.all([
    useEntityStore.getState().loadEntities(areas),
    // First boot: create empty week file silently if none exists,
    // otherwise a dialog would pop before the UI even paints.
    useScheduleStore
      .getState()
      .loadWeek(currentWeek, { silentCreate: true }),
    useDashboardStore.getState().loadRegistry(),
    usePoolStore.getState().loadWeek(currentWeek),
    useHorizonStore.getState().load(),
  ]);
  if (opts?.signal?.aborted) return;
  // Reconcile horizon ↔ entities once both stores are hydrated.
  // Catches up users whose data/horizon.json predates the
  // seed-v2/horizon.json bundle, and prunes orphaned horizon entries
  // pointing at deleted projects.
  const projectIds = new Set(
    useEntityStore
      .getState()
      .entities.filter((e) => e.type === "project")
      .map((e) => e.id),
  );
  const diff = reconcileHorizon(
    projectIds,
    useHorizonStore.getState().projects,
  );
  for (const id of diff.toAdd) {
    if (opts?.signal?.aborted) return;
    await useHorizonStore.getState().addProject(id);
  }
  for (const id of diff.toRemove) {
    if (opts?.signal?.aborted) return;
    await useHorizonStore.getState().removeProject(id);
  }
  if (opts?.signal?.aborted) return;
  await startCommandProcessor();
  await installDashboardHotReload();
}

function App() {
  useEffect(() => {
    let cancelled = false;
    const ctrl = new AbortController();
    // Safety: show window no matter what within 5s, so a hung boot
    // never leaves the user staring at a dock icon forever.
    const safety = window.setTimeout(() => {
      void getCurrentWindow().show();
    }, 5000);

    // 1. Initial show sequence
    void (async () => {
      try {
        await document.fonts.ready;
        if (cancelled) return;
        // Yield for initial shell paint (one frame-ish)
        await new Promise((r) => setTimeout(r, 16));
        if (cancelled) return;
        window.clearTimeout(safety);
        void getCurrentWindow().show();
      } catch (e) {
        // Ignore and let safety timer handle it
      }
    })();

    // 2. Data loading
    void (async () => {
      try {
        await loadAll({ signal: ctrl.signal });
        if (cancelled) return;
        // Open the gate for cross-store subscriptions (entity →
        // horizon, schedule → pool). Until this flag flips, those
        // callbacks no-op so a partially-hydrated store can't be
        // mirrored into another with stale defaults.
        useUIStore.getState().setBootReady(true);
      } catch (e) {
        if (cancelled) return;
        window.clearTimeout(safety);
        const msg =
          e instanceof JsonReadError
            ? `Файл ${e.path}\n\n${e.message}`
            : errMsg(e);
        await message(`Не удалось запустить TuzovOS:\n\n${msg}`, {
          title: "TuzovOS",
          kind: "error",
        });
        await exit(1);
      }
    })();

    return () => {
      cancelled = true;
      ctrl.abort();
      window.clearTimeout(safety);
    };
  }, []);

  // Sync pool when the user navigates between weeks. The schedule
  // store owns currentWeek; pool is a parallel per-week file. Without
  // this subscription the pool sidebar would still show last week's
  // items after the grid switched. Gated on bootReady — initial
  // loadWeek already loaded the matching pool inside Promise.all.
  useEffect(() => {
    const unsub = useScheduleStore.subscribe((state, prev) => {
      if (!useUIStore.getState().bootReady) return;
      if (state.currentWeek !== prev.currentWeek) {
        void usePoolStore.getState().loadWeek(state.currentWeek);
      }
    });
    return () => unsub();
  }, []);

  // Auto-sync project entities into horizon. Diff-based, but the
  // initial loadEntities() set still produces a non-empty diff
  // against the pristine empty store — without the bootReady gate,
  // addProject would fire for every loaded project against a
  // possibly half-hydrated horizon (Promise.all order is unspecified)
  // and persist horizon.json with default sizes/months, clobbering
  // the real values that horizon.load() wrote. Reconciliation in the
  // boot effect already handled the catch-up; this subscription
  // only services new creations/deletions going forward.
  useEffect(() => {
    const unsub = useEntityStore.subscribe((state, prev) => {
      if (!useUIStore.getState().bootReady) return;
      const cur = new Set(
        state.entities.filter((e) => e.type === "project").map((e) => e.id),
      );
      const old = new Set(
        prev.entities.filter((e) => e.type === "project").map((e) => e.id),
      );
      for (const id of cur) {
        if (!old.has(id)) void useHorizonStore.getState().addProject(id);
      }
      for (const id of old) {
        if (!cur.has(id)) void useHorizonStore.getState().removeProject(id);
      }
    });
    return () => unsub();
  }, []);

  // Native menu bar dispatches actions to the frontend over a single
  // "menu" event, payload is the menu item id.
  //
  // StrictMode mounts this effect twice. Without the cancelled flag,
  // the first `listen` resolves after the second mount starts, so
  // both subscriptions stick and every menu click fires twice —
  // invisible for idempotent actions (goToCurrentWeek), fatal for
  // toggles (togglePool flips back to the original state).
  useEffect(() => {
    let unlisten: (() => void) | null = null;
    let cancelled = false;
    void listen<string>("menu", (e) => {
      const ui = useUIStore.getState();
      switch (e.payload) {
        case "new-block":
          // Toggle so a second Cmd+N closes the overlay. The native
          // menu accelerator is consumed by Tauri before reaching the
          // browser keydown listener in Shell, so without toggling
          // here the close-on-repeat shortcut would not work in prod.
          if (ui.quickAdd.open) ui.closeQuickAdd();
          else ui.openQuickAdd();
          break;
        case "today":
          void useScheduleStore.getState().goToCurrentWeek();
          break;
        case "prev-week":
          void useScheduleStore.getState().goToPrevWeek();
          break;
        case "next-week":
          void useScheduleStore.getState().goToNextWeek();
          break;
        case "toggle-pool":
          // Pool only exists on Plan. From any other tab, navigate
          // there without flipping the toggle so the user lands in a
          // predictable state (rather than seeing the pool collapse on
          // arrival).
          if (ui.currentPage !== "plan") {
            ui.setPage("plan");
          } else {
            ui.togglePool();
          }
          break;
      }
    }).then((fn) => {
      if (cancelled) fn();
      else unlisten = fn;
    });
    return () => {
      cancelled = true;
      if (unlisten) unlisten();
    };
  }, []);

  return <Shell />;
}

export default App;
