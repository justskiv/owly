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

function App() {
  useEffect(() => {
    let cancelled = false;
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
        await ensureDataDir();
        // Seed migration runs BEFORE loadConfig — it reads config.json
        // directly via readJsonFile to validate seed areas, and may
        // copy seed-v2/* into data/ if entities.json is empty. The
        // marker .v2-migrated guarantees this runs exactly once.
        await maybeMigrateToV2();
        // Config must load first so entities can warn on unknown tags
        // — areas are passed in explicitly to keep the entity store
        // free of cross-store imports.
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
        // Watcher-driven processors only after stores are ready —
        // a command landing during boot would otherwise see empty
        // schedule/entities snapshots and fail with confusing errors.
        await startCommandProcessor();
        await installDashboardHotReload();
      } catch (e) {
        if (cancelled) return;
        window.clearTimeout(safety);
        const msg =
          e instanceof JsonReadError
            ? `Файл ${e.path}\n\n${e.message}`
            : (e as Error).message;
        await message(`Не удалось запустить TuzovOS:\n\n${msg}`, {
          title: "TuzovOS",
          kind: "error",
        });
        await exit(1);
      }
    })();

    return () => {
      cancelled = true;
      window.clearTimeout(safety);
    };
  }, []);

  // Sync pool when the user navigates between weeks. The schedule
  // store owns currentWeek; pool is a parallel per-week file. Without
  // this subscription the pool sidebar would still show last week's
  // items after the grid switched.
  useEffect(() => {
    const unsub = useScheduleStore.subscribe((state, prev) => {
      if (state.currentWeek !== prev.currentWeek) {
        void usePoolStore.getState().loadWeek(state.currentWeek);
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
          // On Plan, keep the legacy BlockEditor flow (Cmd+N opens the
          // planner block editor inline). On any other tab, route to
          // the entity editor with type=task — this matches the
          // TopNav `+` button so Cmd+N is consistent everywhere and
          // the user is not yanked to Plan unexpectedly.
          if (ui.currentPage === "plan") {
            ui.requestNewBlock();
          } else {
            ui.openEntityEditorNew("task");
          }
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
