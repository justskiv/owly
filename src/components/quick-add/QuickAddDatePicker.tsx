import { useEffect, useMemo, useState } from "react";
import { useUIStore } from "../../store/ui";
import { getStartOfDay } from "../../services/time-utils";
import {
  buildMonthGrid,
  DOW_HEADERS_RU,
  MONTH_NAMES_RU,
  parseIso,
  todayIso as todayIsoNow,
} from "../../services/calendar-i18n";

export function QuickAddDatePicker() {
  const selected = useUIStore((s) => s.quickAdd.pickerSelectedDate);
  const setSelected = useUIStore((s) => s.setPickerSelectedDate);
  const apply = useUIStore((s) => s.applyPickerDate);

  const todayIso = todayIsoNow();

  // viewMonth tracks which month grid is rendered. Auto-syncs to the
  // currently-selected day so arrow-key nav across month boundaries
  // shifts the calendar without explicit handling here. The store
  // primes pickerSelectedDate to today inside openPicker, so `selected`
  // is non-null on first render.
  const [viewMonth, setViewMonth] = useState(() => {
    const seed = selected ? parseIso(selected) : getStartOfDay();
    return { y: seed.getFullYear(), m: seed.getMonth() };
  });

  useEffect(() => {
    if (!selected) return;
    const d = parseIso(selected);
    if (d.getFullYear() !== viewMonth.y || d.getMonth() !== viewMonth.m) {
      setViewMonth({ y: d.getFullYear(), m: d.getMonth() });
    }
  }, [selected, viewMonth.y, viewMonth.m]);

  const days = useMemo(
    () => buildMonthGrid(viewMonth.y, viewMonth.m, todayIso),
    [viewMonth.y, viewMonth.m, todayIso],
  );

  const navigateMonth = (delta: number) => {
    setViewMonth((cur) => {
      const d = new Date(cur.y, cur.m + delta, 1);
      return { y: d.getFullYear(), m: d.getMonth() };
    });
  };
  const resetToToday = () => setSelected(todayIso);

  return (
    <div className="qa-picker" role="dialog" aria-label="Выбор даты">
      <header className="qa-picker-header">
        <button
          type="button"
          className="qa-picker-nav"
          onClick={() => navigateMonth(-1)}
          aria-label="Предыдущий месяц"
        >
          ‹
        </button>
        <span className="qa-picker-title">
          {MONTH_NAMES_RU[viewMonth.m]} {viewMonth.y}
        </span>
        <button
          type="button"
          className="qa-picker-nav"
          onClick={() => navigateMonth(1)}
          aria-label="Следующий месяц"
        >
          ›
        </button>
        <button
          type="button"
          className="qa-picker-today"
          onClick={resetToToday}
        >
          Сегодня
        </button>
      </header>
      <div className="qa-picker-grid">
        {DOW_HEADERS_RU.map((h) => (
          <span key={h} className="qa-picker-dow">
            {h}
          </span>
        ))}
        {days.map((d) => {
          const cls =
            "qa-picker-day" +
            (d.outOfMonth ? " out" : "") +
            (d.isToday ? " today" : "") +
            (d.iso === selected ? " on" : "");
          return (
            <button
              key={d.iso}
              type="button"
              className={cls}
              onClick={() => {
                setSelected(d.iso);
                apply();
              }}
            >
              {d.day}
            </button>
          );
        })}
      </div>
    </div>
  );
}
