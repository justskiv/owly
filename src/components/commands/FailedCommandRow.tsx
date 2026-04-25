import { useState } from "react";
import type { FailedRecord } from "../../store/commands";

interface Props {
  record: FailedRecord;
  onRetry: () => void;
  onDismiss: () => void;
}

// Single row in the FailedCommandsPanel. Action + timestamp on top,
// human-readable error, then a collapsible <details> with the full
// data payload pretty-printed for debugging.
export function FailedCommandRow({ record, onRetry, onDismiss }: Props) {
  const [busy, setBusy] = useState(false);

  const wrap = (fn: () => Promise<void> | void) => async () => {
    if (busy) return;
    setBusy(true);
    try {
      await fn();
    } finally {
      setBusy(false);
    }
  };

  const f = record.file;
  const ts = formatTs(f.failed_at);
  const partial = f.partial
    ? ` · применено ${f.partial.succeeded} из ${
        f.partial.succeeded + 1
      }+, упал #${f.partial.failed_at_index}`
    : "";

  // Replaying a partial batch would re-execute the sub-commands
  // that already succeeded → duplicate blocks/entities. Block
  // retry; the user can craft a manual command for the remaining
  // sub-commands if they need to recover.
  const retryBlocked = f.partial !== undefined;
  const retryTitle = retryBlocked
    ? "Retry заблокирован: batch применён частично, " +
      "повтор продублирует уже выполненные подкоманды"
    : "Вернуть в pending/ для повторной попытки";

  return (
    <div className="fail-row">
      <div className="fail-row-head">
        <span className="fail-action">{f.action}</span>
        <span className="fail-ts">
          {ts}
          {partial}
        </span>
      </div>
      <div className="fail-row-error">{f.error}</div>
      <details>
        <summary>data</summary>
        <pre className="fail-row-data">
          {JSON.stringify(f.data ?? null, null, 2)}
        </pre>
      </details>
      <div className="fail-row-actions">
        <button
          type="button"
          className="btn-ghost"
          onClick={wrap(onDismiss)}
          disabled={busy}
        >
          ✕ Удалить
        </button>
        <button
          type="button"
          className="btn-save"
          onClick={wrap(onRetry)}
          disabled={busy || retryBlocked}
          title={retryTitle}
        >
          ↻ Retry
        </button>
      </div>
    </div>
  );
}

function formatTs(iso: string): string {
  // Show only HH:MM (date is rarely interesting at row level).
  const m = /T(\d{2}:\d{2})/.exec(iso);
  return m ? m[1] : iso;
}
