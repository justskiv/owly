import { useEffect, useRef, useState } from "react";
import { useFocusTrap } from "../../hooks/useFocusTrap";
import { useRestoreFocus } from "../../hooks/useRestoreFocus";
import { useDashboardStore } from "../../store/dashboards";
import { useUIStore } from "../../store/ui";
import { toast } from "../shared/Toast";

interface Props {
  id: string;
}

export function ConfirmDeleteDashboard({ id }: Props) {
  const close = useUIStore((s) => s.closeDashboardEditor);
  const setSelected = useUIStore((s) => s.setSelectedDashboard);
  const selectedId = useUIStore((s) => s.selectedDashboardId);
  const registry = useDashboardStore((s) => s.registry);
  const deleteDashboard = useDashboardStore((s) => s.deleteDashboard);

  const entry = registry.find((d) => d.id === id);
  const dialogRef = useRef<HTMLDivElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const [busy, setBusy] = useState(false);

  useFocusTrap(dialogRef, true);
  useRestoreFocus(true);

  useEffect(() => {
    // Default focus on Cancel — destructive action shouldn't be the
    // first thing Enter activates.
    cancelRef.current?.focus();
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [close]);

  if (!entry) return null;

  const onDelete = async () => {
    setBusy(true);
    try {
      const title = entry.title;
      await deleteDashboard(id);
      if (selectedId === id) setSelected(null);
      toast.success(`✕ Удалён: ${title}`);
      close();
    } catch (e) {
      toast.error(`Не удалось: ${(e as Error).message}`);
      setBusy(false);
    }
  };

  return (
    <div className="modal-bg visible" onMouseDown={close}>
      <div
        ref={dialogRef}
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="del-dash-title"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="m-head">
          <span id="del-dash-title" className="m-title">
            Удалить дашборд?
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
        <div className="m-body">
          <p
            style={{
              color: "var(--text-secondary)",
              fontSize: "var(--fs-md)",
              lineHeight: 1.5,
            }}
          >
            «{entry.title}» и связанный файл{" "}
            <span style={{ fontFamily: "var(--mono)" }}>{entry.file}</span>{" "}
            будут удалены без возможности восстановления.
          </p>
        </div>
        <div className="m-foot">
          <button
            ref={cancelRef}
            type="button"
            className="btn-ghost"
            onClick={close}
            disabled={busy}
          >
            Отмена
          </button>
          <button
            type="button"
            className="btn-del confirm"
            onClick={onDelete}
            disabled={busy}
          >
            {busy ? "Удаляем…" : "Удалить"}
          </button>
        </div>
      </div>
    </div>
  );
}
