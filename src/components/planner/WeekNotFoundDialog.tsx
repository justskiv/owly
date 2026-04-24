import { useEffect, useRef } from "react";
import { useUIStore } from "../../store/ui";
import { useScheduleStore } from "../../store/schedule";
import {
  createEmptyWeek,
  createWeekFromTemplate,
} from "../../services/week-manager";
import {
  formatWeekRange,
  getWeekNumber,
} from "../../services/time-utils";
import { useFocusTrap } from "../../hooks/useFocusTrap";
import { toast } from "../shared/Toast";

export function WeekNotFoundDialog({ weekId }: { weekId: string }) {
  const setPrompt = useUIStore((s) => s.setWeekPrompt);
  const dialogRef = useRef<HTMLDivElement>(null);
  useFocusTrap(dialogRef, true);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPrompt(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setPrompt]);

  const handleTemplate = async () => {
    try {
      await createWeekFromTemplate(weekId);
      await useScheduleStore.getState().loadWeek(weekId, { silentCreate: true });
      toast.success("✓ Неделя создана из шаблона");
    } catch (e) {
      toast.error(`Не удалось: ${(e as Error).message}`);
    }
  };
  const handleEmpty = async () => {
    try {
      await createEmptyWeek(weekId);
      await useScheduleStore.getState().loadWeek(weekId, { silentCreate: true });
    } catch (e) {
      toast.error(`Не удалось: ${(e as Error).message}`);
    }
  };

  return (
    <div className="modal-bg visible" onMouseDown={(e) => e.stopPropagation()}>
      <div
        ref={dialogRef}
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="wnf-title"
      >
        <div className="m-head">
          <span id="wnf-title" className="m-title">
            Неделя {getWeekNumber(weekId)} ({formatWeekRange(weekId)})
          </span>
        </div>
        <div className="m-body">
          <p style={{ color: "var(--text-secondary)", lineHeight: 1.5 }}>
            Файл ещё не создан. Как начать?
          </p>
        </div>
        <div className="m-foot">
          <button
            type="button"
            className="btn-ghost"
            onClick={handleEmpty}
          >
            Пустая
          </button>
          <button
            type="button"
            className="btn-save"
            onClick={handleTemplate}
          >
            Создать из шаблона
          </button>
        </div>
      </div>
    </div>
  );
}
