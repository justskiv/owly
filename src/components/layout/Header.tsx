import { ChevronLeft, ChevronRight } from "lucide-react";
import { useUIStore } from "../../store/ui";
import { useScheduleStore } from "../../store/schedule";
import {
  formatWeekRange,
  getWeekNumber,
} from "../../services/time-utils";

export function Header() {
  const page = useUIStore((s) => s.currentPage);
  const week = useScheduleStore((s) => s.currentWeek);
  const goNext = useScheduleStore((s) => s.goToNextWeek);
  const goPrev = useScheduleStore((s) => s.goToPrevWeek);
  const goToday = useScheduleStore((s) => s.goToCurrentWeek);

  if (page === "planner") {
    return (
      <header className="flex h-12 shrink-0 items-center justify-between border-b border-slate-800 px-4">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => void goPrev()}
            className="flex h-8 w-8 items-center justify-center rounded text-slate-400 hover:bg-slate-800 hover:text-white"
          >
            <ChevronLeft size={18} />
          </button>
          <span className="text-sm text-slate-200">
            Неделя {getWeekNumber(week)} ({formatWeekRange(week)})
          </span>
          <button
            type="button"
            onClick={() => void goNext()}
            className="flex h-8 w-8 items-center justify-center rounded text-slate-400 hover:bg-slate-800 hover:text-white"
          >
            <ChevronRight size={18} />
          </button>
        </div>
        <button
          type="button"
          onClick={() => void goToday()}
          className="rounded px-3 py-1 text-xs text-slate-300 hover:bg-slate-800 hover:text-white"
        >
          Сегодня
        </button>
      </header>
    );
  }

  if (page === "entities") {
    return (
      <header className="flex h-12 shrink-0 items-center justify-between border-b border-slate-800 px-4">
        <h1 className="text-sm text-slate-200">Данные</h1>
        <input
          type="search"
          placeholder="Поиск (скоро)"
          disabled
          className="cursor-not-allowed rounded bg-slate-800/50 px-2 py-1 text-xs text-slate-400 placeholder:text-slate-500"
        />
      </header>
    );
  }

  return (
    <header className="flex h-12 shrink-0 items-center border-b border-slate-800 px-4">
      <h1 className="text-sm text-slate-200">Дашборды</h1>
    </header>
  );
}
