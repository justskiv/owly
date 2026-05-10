import { now } from "./clock";

const DAYS_RU_SHORT = ["вс", "пн", "вт", "ср", "чт", "пт", "сб"];
const MONTHS_RU_SHORT = [
  "янв",
  "фев",
  "мар",
  "апр",
  "май",
  "июн",
  "июл",
  "авг",
  "сен",
  "окт",
  "ноя",
  "дек",
];

// Genitive case for "<day> <month>" templates ("10 мая", "1 января").
// Russian month names inflect with the day number, so `MONTHS_RU_SHORT`
// (which is also abbreviated) is the wrong shape here.
const MONTHS_RU_GENITIVE = [
  "января",
  "февраля",
  "марта",
  "апреля",
  "мая",
  "июня",
  "июля",
  "августа",
  "сентября",
  "октября",
  "ноября",
  "декабря",
];

const DAY_MS = 24 * 60 * 60 * 1000;

export function formatDateRU(d: Date): string {
  return `${DAYS_RU_SHORT[d.getDay()]}, ${d.getDate()} ${MONTHS_RU_SHORT[d.getMonth()]}`;
}

export function formatRelativeRU(d: Date, base: Date): string {
  const baseStart = new Date(base);
  baseStart.setHours(0, 0, 0, 0);
  const targetStart = new Date(d);
  targetStart.setHours(0, 0, 0, 0);
  const diff = Math.round((targetStart.getTime() - baseStart.getTime()) / DAY_MS);
  const long = formatDateRU(d);
  if (diff === 0) return `сегодня, ${long}`;
  if (diff === 1) return `завтра, ${long}`;
  if (diff === 2) return `послезавтра, ${long}`;
  if (diff === -1) return `вчера, ${long}`;
  if (diff > 2 && diff < 8) return `через ${diff} дн., ${long}`;
  return long;
}

export const DAYS_RU_SHORT_LIST = DAYS_RU_SHORT;

// "10 мая" inside the current year, "10 мая 2025" otherwise. `iso` may
// be a date-only string or a full datetime — `new Date(iso)` parses
// both. The year suffix is dropped only when the date is in the same
// civil year as `base`, so January-vs-December comparisons stay
// unambiguous. `base` defaults to clock.now() so frozen-clock tests
// remain deterministic.
export function formatRuDate(iso: string, base?: Date): string {
  const d = new Date(iso);
  const ref = base ?? now();
  const day = d.getDate();
  const month = MONTHS_RU_GENITIVE[d.getMonth()];
  const year = d.getFullYear();
  return year === ref.getFullYear()
    ? `${day} ${month}`
    : `${day} ${month} ${year}`;
}
