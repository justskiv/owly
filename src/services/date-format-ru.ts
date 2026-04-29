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
