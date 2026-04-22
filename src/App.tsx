import { useEffect } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { message } from "@tauri-apps/plugin-dialog";
import { exit } from "@tauri-apps/plugin-process";
import { Shell } from "./components/layout/Shell";
import { useConfigStore } from "./store/config";
import { useEntityStore } from "./store/entities";
import { useScheduleStore } from "./store/schedule";
import { ensureDataDir, JsonReadError } from "./services/file-io";
import { getCurrentWeekId } from "./services/time-utils";

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
        await Promise.all([
          useConfigStore.getState().loadConfig(),
          useEntityStore.getState().loadEntities(),
          useScheduleStore.getState().loadWeek(getCurrentWeekId()),
        ]);
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

  return <Shell />;
}

export default App;
