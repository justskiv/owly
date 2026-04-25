import { useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useUIStore } from "../../store/ui";
import { useScheduleStore } from "../../store/schedule";
import { useDashboardStore } from "../../store/dashboards";
import {
  getWeekNumber,
  formatWeekRange,
} from "../../services/time-utils";
import { CreateDropdown } from "../entities/CreateDropdown";

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
  const togglePool = useUIStore((s) => s.togglePool);

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
        onClick={togglePool}
      >
        Пул<span className="hkbd">T</span>
      </button>
    </>
  );
}

function EntitiesHeader() {
  const search = useUIStore((s) => s.entitySearch);
  const setSearch = useUIStore((s) => s.setEntitySearch);
  const open = useUIStore((s) => s.createDropdownOpen);
  const toggle = useUIStore((s) => s.toggleCreateDropdown);
  const close = useUIStore((s) => s.closeCreateDropdown);
  const btnRef = useRef<HTMLButtonElement>(null);

  return (
    <>
      <div className="hdr-title" data-tauri-drag-region>
        Сущности
      </div>
      <input
        className="search-input"
        placeholder="Поиск..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      <div className="hdr-spacer" data-tauri-drag-region />
      <div className="hdr-create-wrap">
        <button
          ref={btnRef}
          type="button"
          className="hdr-btn"
          onClick={toggle}
          aria-expanded={open}
          aria-haspopup="menu"
        >
          + Создать <span className="hdr-caret">▾</span>
        </button>
        {open && <CreateDropdown anchorRef={btnRef} onClose={close} />}
      </div>
    </>
  );
}

function DashboardsHeader() {
  const selectedId = useUIStore((s) => s.selectedDashboardId);
  const setSelected = useUIStore((s) => s.setSelectedDashboard);
  const openAdd = useUIStore((s) => s.openDashboardEditorAdd);
  const bumpReload = useDashboardStore((s) => s.bumpReload);
  const registry = useDashboardStore((s) => s.registry);
  // Brief disabled window after a reload click. The actual recompile
  // happens synchronously on the next render of DashboardHost, so we
  // don't have an async flag to listen to — 250ms is enough for the
  // user to see "I clicked it" before the button is hot again.
  const [reloading, setReloading] = useState(false);
  const onReload = () => {
    if (reloading) return;
    setReloading(true);
    bumpReload();
    window.setTimeout(() => setReloading(false), 250);
  };

  if (!selectedId) {
    return (
      <>
        <div className="hdr-title" data-tauri-drag-region>
          Дашборды
        </div>
        <div className="hdr-spacer" data-tauri-drag-region />
        <button type="button" className="hdr-btn" onClick={openAdd}>
          + Добавить
        </button>
      </>
    );
  }

  const entry = registry.find((d) => d.id === selectedId);
  return (
    <>
      <button
        type="button"
        className="nav-btn"
        onClick={() => setSelected(null)}
        aria-label="Назад к списку дашбордов"
      >
        <ChevronLeft />
      </button>
      <div className="hdr-bread" data-tauri-drag-region>
        <button
          type="button"
          className="hdr-bread-root"
          onClick={() => setSelected(null)}
        >
          Дашборды
        </button>
        <span className="hdr-bread-sep">›</span>
        <span className="hdr-bread-curr">{entry?.title ?? selectedId}</span>
      </div>
      <div className="hdr-spacer" data-tauri-drag-region />
      <button
        type="button"
        className="hdr-btn-ghost hdr-btn"
        onClick={onReload}
        disabled={reloading}
        title="Перечитать .jsx с диска"
      >
        ↻ Обновить
      </button>
    </>
  );
}
