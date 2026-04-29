import { Plus } from "lucide-react";
import { useScheduleStore } from "../../store/schedule";
import { useUIStore, type Page } from "../../store/ui";
import {
  getWeekOffsetFromCurrent,
  getWeekRangeLabel,
} from "../../services/week-format";

interface TabDef {
  page: Page;
  dataTab: string;
  label: string;
}

const TABS: TabDef[] = [
  { page: "plan", dataTab: "plan", label: "Планирование" },
  { page: "tasks", dataTab: "tasks", label: "Задачи" },
  { page: "projects", dataTab: "proj", label: "Проекты" },
  { page: "context", dataTab: "ctx", label: "Контекст" },
  { page: "horizon", dataTab: "horizon", label: "Горизонт" },
  { page: "review", dataTab: "review", label: "Ревью" },
];

export function TopNav() {
  const currentPage = useUIStore((s) => s.currentPage);
  const setPage = useUIStore((s) => s.setPage);
  const openQuickAdd = useUIStore((s) => s.openQuickAdd);
  const week = useScheduleStore((s) => s.currentWeek);
  const goToPrev = useScheduleStore((s) => s.goToPrevWeek);
  const goToNext = useScheduleStore((s) => s.goToNextWeek);
  const goToCurrent = useScheduleStore((s) => s.goToCurrentWeek);

  const offset = getWeekOffsetFromCurrent(week);
  const label = getWeekRangeLabel(week);

  return (
    <header className="topbar" data-tauri-drag-region>
      <div className="nav-tabs">
        {TABS.map((t) => {
          const active = currentPage === t.page;
          return (
            <button
              key={t.page}
              type="button"
              className={`nav-tab${active ? " active" : ""}`}
              data-tab={t.dataTab}
              aria-current={active ? "page" : undefined}
              onClick={() => setPage(t.page)}
            >
              {t.label}
            </button>
          );
        })}
      </div>
      <div className="nav-spacer" data-tauri-drag-region />
      <div className="nav-week">
        <button
          type="button"
          className={`wk-today${offset === 0 ? " current" : ""}`}
          onClick={() => void goToCurrent()}
          title="Вернуться к текущей неделе"
        >
          Сегодня
        </button>
        <button
          type="button"
          className="wk-arrow"
          onClick={() => void goToPrev()}
          aria-label="Предыдущая неделя"
        >
          ‹
        </button>
        <span className="wk-label">{label}</span>
        <button
          type="button"
          className="wk-arrow"
          onClick={() => void goToNext()}
          aria-label="Следующая неделя"
        >
          ›
        </button>
      </div>
      <button
        type="button"
        className="nav-add-btn"
        onClick={() => openQuickAdd()}
        title="Создать (Cmd+N)"
        aria-label="Создать"
      >
        <Plus size={14} strokeWidth={2} />
      </button>
    </header>
  );
}
