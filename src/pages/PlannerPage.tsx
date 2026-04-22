import { ChevronLeft, ChevronRight } from "lucide-react";
import { useUIStore } from "../store/ui";
import { useScheduleStore } from "../store/schedule";
import { formatWeekRange, getWeekNumber } from "../services/time-utils";

export function PlannerPage() {
  const active = useUIStore((s) => s.currentPage === "planner");
  const week = useScheduleStore((s) => s.currentWeek);
  const blocks = useScheduleStore((s) => s.blocks);
  return (
    <div className={`page${active ? " active" : ""}`}>
      <div className="hdr">
        <button type="button" className="nav-btn" disabled>
          <ChevronLeft />
        </button>
        <span className="hdr-week">
          Неделя {getWeekNumber(week)}
          <span className="hdr-week-sub">{formatWeekRange(week)}</span>
        </span>
        <button type="button" className="nav-btn" disabled>
          <ChevronRight />
        </button>
        <button type="button" className="hdr-today" disabled>
          Сегодня
        </button>
        <div className="hdr-spacer" />
        <button type="button" className="hdr-btn hdr-btn-ghost">
          Пул<span className="hkbd">T</span>
        </button>
      </div>
      <div style={{ padding: 24 }}>
        <h1
          style={{
            fontSize: "var(--fs-xl)",
            fontWeight: 500,
            color: "var(--text-primary)",
            marginBottom: 8,
          }}
        >
          Планировщик будет здесь
        </h1>
        <p
          style={{
            color: "var(--text-secondary)",
            fontSize: "var(--fs-sm)",
          }}
        >
          Неделя: <span style={{ fontFamily: "var(--mono)" }}>{week}</span>.
          Блоков:{" "}
          <span style={{ fontFamily: "var(--mono)" }}>{blocks.length}</span>
        </p>
      </div>
    </div>
  );
}
