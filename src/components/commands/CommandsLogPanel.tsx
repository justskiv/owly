import { useEffect, useRef } from "react";
import { useEscape } from "../../hooks/useEscape";
import { useFocusTrap } from "../../hooks/useFocusTrap";
import { useRestoreFocus } from "../../hooks/useRestoreFocus";
import { useCommandStore } from "../../store/commands";
import { useUIStore } from "../../store/ui";
import { DoneCommandRow } from "./DoneCommandRow";
import { FailedCommandRow } from "./FailedCommandRow";

export function CommandsLogPanel() {
  const close = useUIStore((s) => s.closeCommandsPanel);
  const tab = useUIStore((s) => s.commandsPanelTab);
  const setTab = useUIStore((s) => s.setCommandsPanelTab);

  const done = useCommandStore((s) => s.done);
  const doneTruncated = useCommandStore((s) => s.doneTruncated);
  const failed = useCommandStore((s) => s.failed);
  const loadDone = useCommandStore((s) => s.loadDone);
  const loadFailed = useCommandStore((s) => s.loadFailed);
  const removeDone = useCommandStore((s) => s.removeDone);
  const clearAllDone = useCommandStore((s) => s.clearAllDone);
  const retry = useCommandStore((s) => s.retryFailed);
  const remove = useCommandStore((s) => s.removeFailed);
  const clearAllFailed = useCommandStore((s) => s.clearAllFailed);

  const dialogRef = useRef<HTMLDivElement>(null);
  useFocusTrap(dialogRef, true);
  useRestoreFocus(true);
  useEscape(close);

  // Re-read from disk on open so the log catches anything that
  // landed externally (the agent ran while the panel was closed,
  // user moved a file by hand, etc.). Both reads are cheap.
  useEffect(() => {
    void loadDone();
    void loadFailed();
  }, [loadDone, loadFailed]);

  const showingDone = tab === "done";

  return (
    <div className="modal-bg visible" onMouseDown={close}>
      <div
        ref={dialogRef}
        className="modal modal-wide"
        role="dialog"
        aria-modal="true"
        aria-labelledby="cmd-log-title"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="m-head">
          <span id="cmd-log-title" className="m-title">
            Лог команд
          </span>
          <button
            type="button"
            className="m-close"
            aria-label="Закрыть"
            onClick={close}
          >
            ×
          </button>
        </div>

        <div className="cmd-log-tabs" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={showingDone}
            className={`stab${showingDone ? " active" : ""}`}
            onClick={() => setTab("done")}
          >
            Выполнено · {done.length}
            {doneTruncated && "+"}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={!showingDone}
            className={`stab${!showingDone ? " active" : ""}`}
            onClick={() => setTab("failed")}
          >
            Ошибки · {failed.length}
          </button>
        </div>

        <div className="m-body cmd-log-body">
          {showingDone ? (
            done.length === 0 ? (
              <div className="cmd-log-empty">
                Лог пуст. Команды появятся здесь после выполнения —
                файлы из <code>commands/done/</code>.
              </div>
            ) : (
              <>
                <div className="done-list">
                  {done.map((r) => (
                    <DoneCommandRow
                      key={r.path}
                      record={r}
                      onDismiss={() => removeDone(r.path)}
                    />
                  ))}
                </div>
                {doneTruncated && (
                  <div className="cmd-log-trunc">
                    Показаны последние {done.length} — старее
                    смотри в <code>commands/done/</code>.
                  </div>
                )}
              </>
            )
          ) : failed.length === 0 ? (
            <div className="cmd-log-empty">
              Нет ошибок. Файлы из <code>commands/failed/</code>{" "}
              появятся здесь автоматически.
            </div>
          ) : (
            <div className="fail-list">
              {failed.map((r) => (
                <FailedCommandRow
                  key={r.path}
                  record={r}
                  onRetry={() => retry(r.path)}
                  onDismiss={() => remove(r.path)}
                />
              ))}
            </div>
          )}
        </div>

        <div className="m-foot">
          <button
            type="button"
            className="btn-ghost"
            onClick={() =>
              showingDone ? void clearAllDone() : void clearAllFailed()
            }
            disabled={showingDone ? done.length === 0 : failed.length === 0}
          >
            Очистить {showingDone ? "лог" : "ошибки"}
          </button>
          <button type="button" className="btn-save" onClick={close}>
            Закрыть
          </button>
        </div>
      </div>
    </div>
  );
}
