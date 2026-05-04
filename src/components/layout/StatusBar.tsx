import { useEffect, useRef, useState } from "react";
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
  const saveError = useUIStore((s) => s.saveError);
  const executed = useCommandStore((s) => s.executed);
  const failedCount = useCommandStore((s) => s.failed.length);
  const loadFailed = useCommandStore((s) => s.loadFailed);
  const openPanel = useUIStore((s) => s.openCommandsPanel);
  const [errorPopoverOpen, setErrorPopoverOpen] = useState(false);
  const errorPopoverRef = useRef<HTMLDivElement>(null);

  // Read failed/ once at mount so the badge reflects last-session
  // errors as soon as the status bar paints. Cheap (one listFiles).
  // Done/ list is loaded lazily on panel open — bounded reads
  // (DONE_LIMIT) but still N file reads, no point doing it for the
  // counter.
  useEffect(() => {
    void loadFailed();
  }, [loadFailed]);

  // Close the error popover when status moves out of error — the
  // user fixed the underlying issue and the popover would be
  // showing stale text.
  useEffect(() => {
    if (status !== "error") setErrorPopoverOpen(false);
  }, [status]);

  // Click-away closes the error popover.
  useEffect(() => {
    if (!errorPopoverOpen) return;
    const onAway = (e: MouseEvent) => {
      if (!errorPopoverRef.current?.contains(e.target as Node)) {
        setErrorPopoverOpen(false);
      }
    };
    document.addEventListener("mousedown", onAway);
    return () => document.removeEventListener("mousedown", onAway);
  }, [errorPopoverOpen]);

  const label =
    status === "saving"
      ? "Сохранение…"
      : status === "error"
        ? "Ошибка сохранения"
        : savedAt
          ? `Сохранено ${pad2(savedAt.getHours())}:${pad2(savedAt.getMinutes())}`
          : "Сохранено";

  // The dot is interactive only in error state — clicking it opens
  // a popover with the last error message so the user can copy or
  // read the full text without diving into devtools.
  const dotIsButton = status === "error";

  return (
    <div className="sbar" data-tauri-drag-region>
      {dotIsButton ? (
        <div ref={errorPopoverRef} className="sbar-dot-wrap">
          <button
            type="button"
            className="dot dot-button"
            style={{ background: DOT_COLOR[status] }}
            onClick={() => setErrorPopoverOpen((o) => !o)}
            aria-label="Показать сообщение об ошибке сохранения"
            aria-expanded={errorPopoverOpen}
          />
          {errorPopoverOpen && (
            <div className="sbar-error-popover" role="dialog">
              <div className="sbar-error-title">Ошибка сохранения</div>
              <div className="sbar-error-msg">
                {saveError ?? "Неизвестная ошибка"}
              </div>
            </div>
          )}
        </div>
      ) : (
        <span
          className="dot"
          style={{ background: DOT_COLOR[status] }}
          data-tauri-drag-region
        />
      )}
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
    </div>
  );
}
