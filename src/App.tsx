import { useEffect, useState } from "react";
import { Shell } from "./components/layout/Shell";
import { useConfigStore } from "./store/config";
import { useEntityStore } from "./store/entities";
import { useScheduleStore } from "./store/schedule";
import { ensureDataDir } from "./services/file-io";
import { getCurrentWeekId } from "./services/time-utils";

type BootState = "loading" | "ready" | "error";

function App() {
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
      <div
        style={{
          display: "flex",
          height: "100vh",
          alignItems: "center",
          justifyContent: "center",
          color: "var(--text-tertiary)",
          fontSize: "var(--fs-sm)",
        }}
      >
        Загрузка…
      </div>
    );
  }

  if (bootState === "error") {
    return (
      <div
        style={{
          display: "flex",
          height: "100vh",
          alignItems: "center",
          justifyContent: "center",
          padding: 32,
        }}
      >
        <div
          style={{
            maxWidth: 640,
            padding: 24,
            border: "1px solid var(--error)",
            borderRadius: "var(--radius-lg)",
            background: "var(--bg-surface)",
            color: "var(--text-primary)",
          }}
        >
          <h1
            style={{
              fontSize: "var(--fs-lg)",
              marginBottom: 8,
              fontWeight: 500,
            }}
          >
            Не удалось загрузить данные
          </h1>
          <pre
            style={{
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
              fontFamily: "var(--mono)",
              fontSize: "var(--fs-sm)",
              color: "var(--text-secondary)",
            }}
          >
            {bootError}
          </pre>
        </div>
      </div>
    );
  }

  return <Shell />;
}

export default App;
