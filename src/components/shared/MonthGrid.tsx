import { useEffect, useMemo, useState } from "react";
import {
  buildMonthGrid,
  DOW_HEADERS_RU,
  MONTH_NAMES_RU,
  parseIso,
} from "../../services/calendar-i18n";

interface MonthGridProps {
  // Currently-selected ISO date or null. Drives the "on" cell.
  value: string | null;
  // Today's ISO — passed in so callers can keep their own re-render
  // cadence (e.g. midnight rollover); the grid stays a pure view.
  todayIso: string;
  onChange: (iso: string) => void;
  // Reset link target. Defaults to "Сегодня" + setting today as value.
  onResetToday?: () => void;
  // Adopts an existing CSS namespace, e.g. "ep-dl" → ".ep-dl-grid",
  // ".ep-dl-day", ".ep-dl-header" etc. Lets the popup variant style the
  // same primitive differently from the Quick Add one.
  classPrefix: string;
}

export function MonthGrid({
  value,
  todayIso,
  onChange,
  onResetToday,
  classPrefix,
}: MonthGridProps) {
  // The view month follows the selected date when it lands in another
  // month — same auto-sync the Quick Add picker uses.
  const [viewMonth, setViewMonth] = useState(() => {
    const seed = value ? parseIso(value) : parseIso(todayIso);
    return { y: seed.getFullYear(), m: seed.getMonth() };
  });

  useEffect(() => {
    if (!value) return;
    const d = parseIso(value);
    if (d.getFullYear() !== viewMonth.y || d.getMonth() !== viewMonth.m) {
      setViewMonth({ y: d.getFullYear(), m: d.getMonth() });
    }
  }, [value, viewMonth.y, viewMonth.m]);

  const days = useMemo(
    () => buildMonthGrid(viewMonth.y, viewMonth.m, todayIso),
    [viewMonth.y, viewMonth.m, todayIso],
  );

  const navigate = (delta: number) => {
    setViewMonth((cur) => {
      const d = new Date(cur.y, cur.m + delta, 1);
      return { y: d.getFullYear(), m: d.getMonth() };
    });
  };

  return (
    <div className={`${classPrefix}-month`}>
      <header className={`${classPrefix}-header`}>
        <button
          type="button"
          className={`${classPrefix}-nav`}
          onClick={() => navigate(-1)}
          aria-label="Предыдущий месяц"
        >
          ‹
        </button>
        <span className={`${classPrefix}-title`}>
          {MONTH_NAMES_RU[viewMonth.m]} {viewMonth.y}
        </span>
        <button
          type="button"
          className={`${classPrefix}-nav`}
          onClick={() => navigate(1)}
          aria-label="Следующий месяц"
        >
          ›
        </button>
        {onResetToday && (
          <button
            type="button"
            className={`${classPrefix}-today`}
            onClick={onResetToday}
          >
            Сегодня
          </button>
        )}
      </header>
      <div className={`${classPrefix}-grid`}>
        {DOW_HEADERS_RU.map((h) => (
          <span key={h} className={`${classPrefix}-dow`}>
            {h}
          </span>
        ))}
        {days.map((d) => {
          const cls =
            `${classPrefix}-day` +
            (d.outOfMonth ? " out" : "") +
            (d.isToday ? " today" : "") +
            (d.iso === value ? " on" : "");
          return (
            <button
              key={d.iso}
              type="button"
              className={cls}
              onClick={() => onChange(d.iso)}
            >
              {d.day}
            </button>
          );
        })}
      </div>
    </div>
  );
}
