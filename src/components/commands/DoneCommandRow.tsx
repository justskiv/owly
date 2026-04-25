import { useState } from "react";
import type { DoneRecord } from "../../store/commands";
import { formatHHMM, summarizeCommand } from "./summarize";

interface Props {
  record: DoneRecord;
  onDismiss: () => void;
}

// Single row in the "Выполнено" tab. Read-only: there's no retry —
// the command is already applied. Dismiss deletes the file from
// commands/done/ for users who want to keep the log tidy.
export function DoneCommandRow({ record, onDismiss }: Props) {
  const [busy, setBusy] = useState(false);
  const f = record.file;
  const summary = summarizeCommand(f.action, f.data);
  const ts = formatHHMM(f.timestamp);

  const wrap = (fn: () => Promise<void> | void) => async () => {
    if (busy) return;
    setBusy(true);
    try {
      await fn();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="done-row">
      <span className="done-check">✓</span>
      <span className="done-action">{f.action}</span>
      <span className="done-summary">{summary}</span>
      <span className="done-ts">{ts}</span>
      <button
        type="button"
        className="done-dismiss"
        aria-label="Удалить из лога"
        title="Удалить файл из commands/done/"
        onClick={wrap(onDismiss)}
        disabled={busy}
      >
        ×
      </button>
    </div>
  );
}
