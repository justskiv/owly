// LEGACY — phase 6 backup, removed in phase 9
import { useEffect, useRef, useState } from "react";
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
  const goToCurrent = useScheduleStore((s) => s.goToCurrentWeek);
  const dialogRef = useRef<HTMLDivElement>(null);
  const primaryRef = useRef<HTMLButtonElement>(null);
  const [busy, setBusy] = useState(false);
  useFocusTrap(dialogRef, true);

  // Keyboard: Tab-trap handles inside moves, but focus needs to move
  // INTO the dialog first — Shell blocks tabbing from the opener.
  useEffect(() => {
    primaryRef.current?.focus();
  }, []);

  // Escape dismissing into a missing-but-loaded empty week would leave
  // the user looking at a grid that doesn't match any file on disk,
  // and any subsequent mutation would re-raise the prompt. Instead we
  // navigate back to the current week, which always has a file (App
  // creates it on boot via silentCreate).
  const cancel = () => {
    setPrompt(null);
    void goToCurrent();
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) cancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // cancel is stable via refs inside; deps intentionally minimal
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [busy]);

  const handleTemplate = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await createWeekFromTemplate(weekId);
      await useScheduleStore
        .getState()
        .loadWeek(weekId, { silentCreate: true });
      toast.success("✓ Неделя создана из шаблона");
    } catch (e) {
      toast.error(`Не удалось: ${(e as Error).message}`);
      setBusy(false);
    }
  };

  const handleEmpty = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await createEmptyWeek(weekId);
      await useScheduleStore
        .getState()
        .loadWeek(weekId, { silentCreate: true });
      toast.success("✓ Пустая неделя создана");
    } catch (e) {
      toast.error(`Не удалось: ${(e as Error).message}`);
      setBusy(false);
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
            disabled={busy}
          >
            Пустая
          </button>
          <button
            ref={primaryRef}
            type="button"
            className="btn-save"
            onClick={handleTemplate}
            disabled={busy}
          >
            Создать из шаблона
          </button>
        </div>
      </div>
    </div>
  );
}
