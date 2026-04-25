import { useEffect, useRef, useState } from "react";
import { useFocusTrap } from "../../hooks/useFocusTrap";
import { useRestoreFocus } from "../../hooks/useRestoreFocus";
import { useDashboardStore } from "../../store/dashboards";
import { useUIStore } from "../../store/ui";
import { toast } from "../shared/Toast";

interface Props {
  id: string;
}

export function RenameDashboardModal({ id }: Props) {
  const close = useUIStore((s) => s.closeDashboardEditor);
  const registry = useDashboardStore((s) => s.registry);
  const renameDashboard = useDashboardStore((s) => s.renameDashboard);

  const entry = registry.find((d) => d.id === id);
  const dialogRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLInputElement>(null);

  const [title, setTitle] = useState(entry?.title ?? "");
  const [busy, setBusy] = useState(false);

  useFocusTrap(dialogRef, true);
  useRestoreFocus(true);

  useEffect(() => {
    titleRef.current?.focus();
    titleRef.current?.select();
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [close]);

  if (!entry) return null;

  const onSave = async () => {
    const t = title.trim();
    if (!t) {
      toast.error("Название не может быть пустым");
      return;
    }
    if (t === entry.title) {
      close();
      return;
    }
    setBusy(true);
    try {
      await renameDashboard(id, t);
      toast.success(`✓ Переименован: ${t}`);
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
        aria-labelledby="rn-dash-title"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="m-head">
          <span id="rn-dash-title" className="m-title">
            Переименовать дашборд
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
          <div className="fg">
            <label className="fl" htmlFor="rn-dash-name">
              Название
            </label>
            <input
              id="rn-dash-name"
              ref={titleRef}
              className="fi"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void onSave();
                }
              }}
            />
          </div>
        </div>
        <div className="m-foot">
          <span />
          <button
            type="button"
            className="btn-save"
            onClick={onSave}
            disabled={busy}
          >
            {busy ? "Сохраняем…" : "Сохранить"}
          </button>
        </div>
      </div>
    </div>
  );
}
