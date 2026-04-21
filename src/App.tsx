import { useEffect, useState } from "react";
import { Shell } from "./components/layout/Shell";
import { PlannerPage } from "./pages/PlannerPage";
import { EntitiesPage } from "./pages/EntitiesPage";
import { DashboardsPage } from "./pages/DashboardsPage";
import { useUIStore } from "./store/ui";
import { useConfigStore } from "./store/config";
import { useEntityStore } from "./store/entities";
import { useScheduleStore } from "./store/schedule";
import { ensureDataDir } from "./services/file-io";
import { getCurrentWeekId } from "./services/time-utils";

type BootState = "loading" | "ready" | "error";

function App() {
  const page = useUIStore((s) => s.currentPage);
  const [bootState, setBootState] = useState<BootState>("loading");
  const [bootError, setBootError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        await ensureDataDir();
        await useConfigStore.getState().loadConfig();
        await useEntityStore.getState().loadEntities();
        await useScheduleStore.getState().loadWeek(getCurrentWeekId());
        if (!cancelled) setBootState("ready");
      } catch (e) {
        if (!cancelled) {
          setBootError((e as Error).message);
          setBootState("error");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (bootState === "loading") {
    return (
      <div className="flex h-full items-center justify-center text-slate-400">
        <p>Загрузка…</p>
      </div>
    );
  }

  if (bootState === "error") {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <div className="max-w-2xl rounded-lg border border-red-900 bg-red-950/50 p-6 text-red-200">
          <h1 className="mb-2 text-lg font-medium">
            Не удалось загрузить данные
          </h1>
          <pre className="whitespace-pre-wrap break-words text-sm text-red-100">
            {bootError}
          </pre>
        </div>
      </div>
    );
  }

  return (
    <Shell>
      {page === "planner" && <PlannerPage />}
      {page === "entities" && <EntitiesPage />}
      {page === "dashboards" && <DashboardsPage />}
    </Shell>
  );
}

export default App;
