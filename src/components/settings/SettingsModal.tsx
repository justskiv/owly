import { useEffect, useRef } from "react";
import { useUIStore, type SettingsTab } from "../../store/ui";
import { useFocusTrap } from "../../hooks/useFocusTrap";
import { useRestoreFocus } from "../../hooks/useRestoreFocus";
import { AreasTab } from "./AreasTab";
import { PipelineTab } from "./PipelineTab";
import { TemplateTab } from "./TemplateTab";
import { DataTab } from "./DataTab";

const TABS: { id: SettingsTab; label: string }[] = [
  { id: "areas", label: "Области" },
  { id: "template", label: "Шаблон" },
  { id: "pipeline", label: "Пайплайн" },
  { id: "data", label: "Данные" },
];

export function SettingsModal() {
  const tab = useUIStore((s) => s.settingsTab);
  const setTab = useUIStore((s) => s.setSettingsTab);
  const close = useUIStore((s) => s.closeSettings);
  const dialogRef = useRef<HTMLDivElement>(null);
  useFocusTrap(dialogRef, true);
  useRestoreFocus(true);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [close]);

  return (
    <div className="modal-bg visible" onMouseDown={close}>
      <div
        ref={dialogRef}
        className="modal modal-wide"
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-title"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="m-head">
          <span id="settings-title" className="m-title">
            Настройки
          </span>
          <button
            type="button"
            className="m-close"
            onClick={close}
            aria-label="Закрыть"
          >
            ×
          </button>
        </div>
        <div className="settings-tabs">
          {TABS.map(({ id, label }) => (
            <button
              key={id}
              type="button"
              className={`stab${tab === id ? " active" : ""}`}
              onClick={() => setTab(id)}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="m-body settings-body">
          {tab === "areas" && <AreasTab />}
          {tab === "template" && <TemplateTab />}
          {tab === "pipeline" && <PipelineTab />}
          {tab === "data" && <DataTab />}
        </div>
      </div>
    </div>
  );
}
