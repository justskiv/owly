import { ChevronLeft, ChevronRight } from "lucide-react";
import { useUIStore } from "../../store/ui";
import { useScheduleStore } from "../../store/schedule";
import { 
  getWeekNumber, 
  formatWeekRange 
} from "../../services/time-utils";

export function Header() {
  const currentPage = useUIStore((s) => s.currentPage);
  
  return (
    <header className="hdr" data-tauri-drag-region>
      {currentPage === "planner" && <PlannerHeader />}
      {currentPage === "entities" && <EntitiesHeader />}
      {currentPage === "dashboards" && <DashboardsHeader />}
    </header>
  );
}

function PlannerHeader() {
  const week = useScheduleStore((s) => s.currentWeek);
  const goToPrev = useScheduleStore((s) => s.goToPrevWeek);
  const goToNext = useScheduleStore((s) => s.goToNextWeek);
  const goToCurrent = useScheduleStore((s) => s.goToCurrentWeek);
  const setSelectedBlock = useUIStore((s) => s.setSelectedBlock);

  const navWeek = (fn: () => Promise<void> | void) => () => {
    setSelectedBlock(null);
    void fn();
  };

  return (
    <>
      <button
        type="button"
        className="nav-btn"
        onClick={navWeek(goToPrev)}
        aria-label="Предыдущая неделя"
      >
        <ChevronLeft />
      </button>
      <span className="hdr-week" data-tauri-drag-region>
        Неделя {getWeekNumber(week)}
        <span className="hdr-week-sub" data-tauri-drag-region>
          {formatWeekRange(week)}
        </span>
      </span>
      <button
        type="button"
        className="nav-btn"
        onClick={navWeek(goToNext)}
        aria-label="Следующая неделя"
      >
        <ChevronRight />
      </button>
      <button
        type="button"
        className="hdr-today"
        onClick={navWeek(goToCurrent)}
      >
        Сегодня
      </button>
      <div className="hdr-spacer" data-tauri-drag-region />
      <button
        type="button"
        className="hdr-btn hdr-btn-ghost"
        onClick={() => {
          /* фаза 3: пул задач */
        }}
      >
        Пул<span className="hkbd">T</span>
      </button>
    </>
  );
}

function EntitiesHeader() {
  return (
    <>
      <div className="hdr-title" data-tauri-drag-region>
        Сущности
      </div>
      <input className="search-input" placeholder="Поиск..." />
      <div className="hdr-spacer" data-tauri-drag-region />
      <button type="button" className="hdr-btn" disabled>
        + Создать
      </button>
    </>
  );
}

function DashboardsHeader() {
  return (
    <>
      <div className="hdr-title" data-tauri-drag-region>
        Дашборды
      </div>
      <div className="hdr-spacer" data-tauri-drag-region />
      <button type="button" className="hdr-btn" disabled>
        + Добавить
      </button>
    </>
  );
}
