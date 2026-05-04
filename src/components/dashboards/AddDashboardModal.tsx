import { useEffect, useRef, useState } from "react";
import { useEscape } from "../../hooks/useEscape";
import { useFocusTrap } from "../../hooks/useFocusTrap";
import { useRestoreFocus } from "../../hooks/useRestoreFocus";
import { useDashboardStore } from "../../store/dashboards";
import { useUIStore } from "../../store/ui";
import { toast } from "../shared/Toast";
import { errMsg } from "../../services/format";

export function AddDashboardModal() {
  const close = useUIStore((s) => s.closeDashboardEditor);
  const setSelected = useUIStore((s) => s.setSelectedDashboard);
  const addDashboard = useDashboardStore((s) => s.addDashboard);

  const dialogRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLInputElement>(null);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [icon, setIcon] = useState("📊");
  const [busy, setBusy] = useState(false);

  useFocusTrap(dialogRef, true);
  useRestoreFocus(true);
  useEscape(close);

  useEffect(() => {
    titleRef.current?.focus();
  }, []);

  const onSave = async () => {
    const t = title.trim();
    if (!t) {
      toast.error("Название не может быть пустым");
      return;
    }
    setBusy(true);
    try {
      const entry = await addDashboard({
        title: t,
        description: description.trim(),
        icon: icon.trim() || "📊",
      });
      toast.success(`✓ Создан: ${entry.title}`);
      setSelected(entry.id);
      close();
    } catch (e) {
      toast.error(`Не удалось: ${errMsg(e)}`);
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
        aria-labelledby="add-dash-title"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="m-head">
          <span id="add-dash-title" className="m-title">
            Новый дашборд
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
            <label className="fl" htmlFor="add-dash-name">
              Название *
            </label>
            <input
              id="add-dash-name"
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
          <div className="fg">
            <label className="fl" htmlFor="add-dash-desc">
              Описание
            </label>
            <input
              id="add-dash-desc"
              className="fi"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Короткая подсказка под названием"
            />
          </div>
          <div className="fg">
            <label className="fl" htmlFor="add-dash-icon">
              Иконка
            </label>
            <input
              id="add-dash-icon"
              className="fi"
              value={icon}
              onChange={(e) => setIcon(e.target.value)}
              placeholder="Эмодзи или имя Lucide (bar-chart, target, …)"
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
            {busy ? "Создаём…" : "Создать"}
          </button>
        </div>
      </div>
    </div>
  );
}
