import { useEffect, useMemo, useState } from "react";
import { useUIStore } from "../../store/ui";
import { formatDate, getStartOfDay } from "../../services/time-utils";

// Re-derive on each render so the picker's "today" highlight stays
// correct across midnight rollovers.
function todayIsoNow(): string {
  return formatDate(getStartOfDay());
}

const MONTH_NAMES_RU = [
  "Январь",
  "Февраль",
  "Март",
  "Апрель",
  "Май",
  "Июнь",
  "Июль",
  "Август",
  "Сентябрь",
  "Октябрь",
  "Ноябрь",
  "Декабрь",
];
const DOW_HEADERS = ["пн", "вт", "ср", "чт", "пт", "сб", "вс"];

interface GridDay {
  iso: string;
  day: number;
  outOfMonth: boolean;
  isToday: boolean;
}

function parseIso(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function buildMonthGrid(y: number, m: number, todayIso: string): GridDay[] {
  const first = new Date(y, m, 1);
  // ISO week starts on Monday — JS getDay returns 0 for Sunday, so we
  // shift by +6 mod 7 to land Monday at 0.
  const offsetMon = (first.getDay() + 6) % 7;
  const start = new Date(y, m, 1 - offsetMon);
  const days: GridDay[] = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    const iso = formatDate(d);
    days.push({
      iso,
      day: d.getDate(),
      outOfMonth: d.getMonth() !== m,
      isToday: iso === todayIso,
    });
  }
  return days;
}

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
        {DOW_HEADERS.map((h) => (
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
