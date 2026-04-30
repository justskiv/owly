import { formatDate, getStartOfDay } from "./time-utils";

export const MONTH_NAMES_RU = [
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

export const DOW_HEADERS_RU = ["пн", "вт", "ср", "чт", "пт", "сб", "вс"];

export interface GridDay {
  iso: string;
  day: number;
  outOfMonth: boolean;
  isToday: boolean;
}

export function parseIso(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function todayIso(): string {
  return formatDate(getStartOfDay());
}

export function addDays(iso: string, n: number): string {
  const d = parseIso(iso);
  d.setDate(d.getDate() + n);
  return formatDate(d);
}

// Builds a 6-row × 7-col month grid starting on Monday. The leading
// edge is the Monday of the week containing day 1; trailing edge fills
// to 42 cells with overflow days from the next month.
export function buildMonthGrid(
  y: number,
  m: number,
  today: string,
): GridDay[] {
  const first = new Date(y, m, 1);
  // JS getDay() returns 0 for Sunday; shift so Monday is 0.
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
      isToday: iso === today,
    });
  }
  return days;
}
