import {
  getCurrentWeekId,
  getWeekNumber,
  getWeekStartDate,
} from "./time-utils";

// Russian month names in genitive case for date strings like
// "3 мая" / "27 апреля". MONTHS_RU in time-utils is the short
// nominative form — this label needs the genitive variant.
const MONTHS_GENITIVE = [
  "янв",
  "фев",
  "мар",
  "апр",
  "мая",
  "июн",
  "июл",
  "авг",
  "сен",
  "окт",
  "ноя",
  "дек",
];

const MS_PER_WEEK = 7 * 24 * 60 * 60 * 1000;

function parseISO(s: string): Date {
  const [y, m, d] = s.split("-").map((p) => parseInt(p, 10));
  return new Date(y, m - 1, d);
}

export function getWeekOffsetFromCurrent(weekId: string): number {
  const a = parseISO(getWeekStartDate(weekId)).getTime();
  const b = parseISO(getWeekStartDate(getCurrentWeekId())).getTime();
  return Math.round((a - b) / MS_PER_WEEK);
}

export function getWeekRangeLabel(weekId: string): string {
  const start = parseISO(getWeekStartDate(weekId));
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  const w = getWeekNumber(weekId);
  const startStr = `${start.getDate()} ${MONTHS_GENITIVE[start.getMonth()]}`;
  const endStr = `${end.getDate()} ${MONTHS_GENITIVE[end.getMonth()]}`;
  return `W${w} · ${startStr} — ${endStr}`;
}
