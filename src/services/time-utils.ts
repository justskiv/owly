const MS_PER_DAY = 24 * 60 * 60 * 1000;
const MONTHS_RU = [
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

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function isoWeekParts(input: Date): { year: number; week: number } {
  const date = startOfDay(input);
  const day = (date.getDay() + 6) % 7; // 0 = пн
  const thursday = new Date(date);
  thursday.setDate(date.getDate() - day + 3);
  const year = thursday.getFullYear();
  const jan1 = new Date(year, 0, 1);
  const jan1Day = (jan1.getDay() + 6) % 7;
  const firstThursday = new Date(year, 0, 1 + ((3 - jan1Day + 7) % 7));
  const week =
    Math.floor((thursday.getTime() - firstThursday.getTime()) / (7 * MS_PER_DAY)) + 1;
  return { year, week };
}

function formatDate(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function parseDate(s: string): Date {
  const [y, m, d] = s.split("-").map((p) => parseInt(p, 10));
  return new Date(y, m - 1, d);
}

function formatWeekId(year: number, week: number): string {
  return `${year}-w${pad2(week)}`;
}

function parseWeekId(weekId: string): { year: number; week: number } {
  const m = weekId.match(/^(\d{4})-w(\d{1,2})$/);
  if (!m) throw new Error(`Invalid week id: ${weekId}`);
  return { year: parseInt(m[1], 10), week: parseInt(m[2], 10) };
}

export function getCurrentWeekId(): string {
  const { year, week } = isoWeekParts(new Date());
  return formatWeekId(year, week);
}

export function getWeekStartDate(weekId: string): string {
  const { year, week } = parseWeekId(weekId);
  const jan4 = new Date(year, 0, 4);
  const jan4Day = (jan4.getDay() + 6) % 7;
  const week1Monday = new Date(jan4);
  week1Monday.setDate(jan4.getDate() - jan4Day);
  const target = new Date(week1Monday);
  target.setDate(week1Monday.getDate() + (week - 1) * 7);
  return formatDate(target);
}

export function getWeekDates(weekId: string): string[] {
  const start = parseDate(getWeekStartDate(weekId));
  const dates: string[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    dates.push(formatDate(d));
  }
  return dates;
}

export function addWeeks(weekId: string, delta: number): string {
  const start = parseDate(getWeekStartDate(weekId));
  start.setDate(start.getDate() + delta * 7);
  const { year, week } = isoWeekParts(start);
  return formatWeekId(year, week);
}

export function getWeekNumber(weekId: string): number {
  return parseWeekId(weekId).week;
}

export function formatWeekRange(weekId: string): string {
  const start = parseDate(getWeekStartDate(weekId));
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  if (start.getMonth() === end.getMonth()) {
    return `${start.getDate()}–${end.getDate()} ${MONTHS_RU[start.getMonth()]}`;
  }
  return (
    `${start.getDate()} ${MONTHS_RU[start.getMonth()]} – ` +
    `${end.getDate()} ${MONTHS_RU[end.getMonth()]}`
  );
}

export function nowISO(): string {
  const d = new Date();
  return (
    `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}` +
    `T${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`
  );
}

export function generateId(prefix: string): string {
  const buf = new Uint8Array(4);
  crypto.getRandomValues(buf);
  const hex = Array.from(buf)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return `${prefix}-${hex}`;
}
