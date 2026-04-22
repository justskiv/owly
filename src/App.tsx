import { useEffect, useState } from "react";
import { Shell } from "./components/layout/Shell";
import { useConfigStore } from "./store/config";
import { useEntityStore } from "./store/entities";
import { useScheduleStore } from "./store/schedule";
import { ensureDataDir } from "./services/file-io";
import { getCurrentWeekId } from "./services/time-utils";

function BootErrorBanner({ message }: { message: string }) {
  return (
    <div
      role="alert"
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        padding: "8px 16px",
        background: "var(--error)",
        color: "var(--text-inverse)",
        fontSize: "var(--fs-sm)",
        fontFamily: "var(--font)",
        zIndex: 3000,
        display: "flex",
        gap: 12,
        alignItems: "baseline",
      }}
    >
      <strong>Не удалось загрузить данные.</strong>
      <span style={{ opacity: 0.85 }}>{message}</span>
      <span style={{ marginLeft: "auto", opacity: 0.7 }}>
        Перезапустите приложение, чтобы повторить попытку.
      </span>
    </div>
  );
}

function App() {
  const [error, setError] = useState<string | null>(null);
  const [booting, setBooting] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        await ensureDataDir();
        await Promise.all([
          useConfigStore.getState().loadConfig(),
          useEntityStore.getState().loadEntities(),
          useScheduleStore.getState().loadWeek(getCurrentWeekId()),
        ]);
      } catch (e) {
        if (!cancelled) setError((e as Error).message);
      } finally {
        if (!cancelled) setBooting(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <>
      <Shell booting={booting} />
      {error && <BootErrorBanner message={error} />}
    </>
  );
}

export default App;
