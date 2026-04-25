import { useEffect } from "react";
import { AlertTriangle, Inbox } from "lucide-react";
import { useCommandStore } from "../../store/commands";
import { useEntityStore } from "../../store/entities";
import { useUIStore, type SaveStatus } from "../../store/ui";
import { pluralRu } from "../../services/format";

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

const DOT_COLOR: Record<SaveStatus, string> = {
  idle: "var(--success)",
  saved: "var(--success)",
  saving: "var(--accent)",
  error: "var(--error)",
};

export function StatusBar() {
  const count = useEntityStore((s) => s.entities.length);
  const status = useUIStore((s) => s.saveStatus);
  const savedAt = useUIStore((s) => s.savedAt);
  const executed = useCommandStore((s) => s.executed);
  const failedCount = useCommandStore((s) => s.failed.length);
  const loadFailed = useCommandStore((s) => s.loadFailed);
  const openPanel = useUIStore((s) => s.openCommandsPanel);

  // Read failed/ once at mount so the badge reflects last-session
  // errors as soon as the status bar paints. Cheap (one listFiles).
  // Done/ list is loaded lazily on panel open — bounded reads
  // (DONE_LIMIT) but still N file reads, no point doing it for the
  // counter.
  useEffect(() => {
    void loadFailed();
  }, [loadFailed]);

  const label =
    status === "saving"
      ? "Сохранение…"
      : status === "error"
        ? "Ошибка сохранения"
        : savedAt
          ? `Сохранено ${pad2(savedAt.getHours())}:${pad2(savedAt.getMinutes())}`
          : "Сохранено";

  return (
    <div className="sbar" data-tauri-drag-region>
      <span
        className="dot"
        style={{ background: DOT_COLOR[status] }}
        data-tauri-drag-region
      />
      <span
        role="status"
        aria-live="polite"
        aria-label="Статус сохранения"
        data-tauri-drag-region
      >
        {label}
      </span>
      <span className="sep" data-tauri-drag-region />
      <span data-tauri-drag-region>
        {count} {pluralRu(count, "сущность", "сущности", "сущностей")}
      </span>
      <span className="sep" data-tauri-drag-region />
      <button
        type="button"
        className="sbar-cmd"
        onClick={() => openPanel("done")}
        title="Открыть лог команд"
      >
        <Inbox size={11} strokeWidth={1.75} aria-hidden="true" />
        {executed} выполнено
      </button>
      {failedCount > 0 && (
        <>
          <span className="sep" data-tauri-drag-region />
          <button
            type="button"
            className="sbar-cmd sbar-failed"
            onClick={() => openPanel("failed")}
            title="Открыть лог ошибок команд"
          >
            <AlertTriangle size={11} strokeWidth={1.75} aria-hidden="true" />
            {failedCount}{" "}
            {pluralRu(failedCount, "ошибка", "ошибки", "ошибок")}
          </button>
        </>
      )}
      <div className="hints" data-tauri-drag-region>
        <span data-tauri-drag-region>
          <kbd data-tauri-drag-region>1</kbd>
          <kbd data-tauri-drag-region>2</kbd>
          <kbd data-tauri-drag-region>3</kbd> страницы
        </span>
        <span data-tauri-drag-region>
          <kbd data-tauri-drag-region>N</kbd> блок
        </span>
      </div>
    </div>
  );
}
