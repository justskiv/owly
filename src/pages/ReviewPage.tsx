import { MonthCards } from "../components/review/MonthCards";
import { WeekCards } from "../components/review/WeekCards";
import { YearCards } from "../components/review/YearCards";
import { useReviewData } from "../hooks/useReviewData";
import { formatWeekRange, getWeekNumber } from "../services/time-utils";
import { useScheduleStore } from "../store/schedule";
import { useUIStore } from "../store/ui";

const PERIODS = [
  { id: "week", label: "Неделя" },
  { id: "month", label: "Месяц" },
  { id: "year", label: "Год" },
] as const;

export function ReviewPage() {
  const rvPeriod = useUIStore((s) => s.rvPeriod);
  const setRvPeriod = useUIStore((s) => s.setRvPeriod);
  const currentWeek = useScheduleStore((s) => s.currentWeek);
  const data = useReviewData(rvPeriod, currentWeek);

  return (
    <div className="review-view" data-screen="review">
      <div className="review-inner">
        <h1>Ревью</h1>
        <div className="rv-week-label">
          W{getWeekNumber(currentWeek)} · {formatWeekRange(currentWeek)}
        </div>
        <div className="rv-tabs">
          {PERIODS.map((p) => (
            <button
              key={p.id}
              className={"rv-tab" + (rvPeriod === p.id ? " active" : "")}
              onClick={() => setRvPeriod(p.id)}
            >
              {p.label}
            </button>
          ))}
        </div>
        <div className="review-cards-grid">
          {rvPeriod === "week" && <WeekCards data={data} />}
          {rvPeriod === "month" && <MonthCards data={data} />}
          {rvPeriod === "year" && <YearCards data={data} />}
        </div>
      </div>
    </div>
  );
}
