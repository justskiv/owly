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

export const ROW_H = 40;
export const START_HOUR = 6;
export const END_HOUR = 23;
export const SNAP_MIN = 30;
export const MIN_BLOCK_MIN = 30;
export const VISIBLE_ROWS = (END_HOUR - START_HOUR) * 2;
export const DAY_CAPACITY_MIN = (END_HOUR - START_HOUR) * 60;
export const WEEK_CAPACITY_MIN = DAY_CAPACITY_MIN * 7;
export const WEEKDAYS_RU = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"] as const;
export const DEFAULT_BLOCK_DURATION_MIN = 60;
export const DEFAULT_BLOCK_CATEGORY = "work";

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

export function formatDate(d: Date): string {
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
  return `${prefix}-${crypto.randomUUID()}`;
}

export function timeToMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map((p) => parseInt(p, 10));
  return (Number.isFinite(h) ? h : 0) * 60 + (Number.isFinite(m) ? m : 0);
}

const HHMM_RE = /^(\d{1,2}):(\d{2})$/;

export function parseHHMMStrict(s: string): number | null {
  const m = HHMM_RE.exec(s.trim());
  if (!m) return null;
  const h = parseInt(m[1], 10);
  const min = parseInt(m[2], 10);
  if (h < 0 || h > 23 || min < 0 || min > 59) return null;
  return h * 60 + min;
}

export function minutesToTime(min: number): string {
  const total = ((min % (24 * 60)) + 24 * 60) % (24 * 60);
  return `${pad2(Math.floor(total / 60))}:${pad2(total % 60)}`;
}

export const fmtTime = minutesToTime;

export function clampBlockToGrid(
  startMin: number,
  durationMin: number,
): { start: number; duration: number } {
  const minStart = START_HOUR * 60;
  const maxEnd = END_HOUR * 60;
  let dur = Math.round(durationMin / SNAP_MIN) * SNAP_MIN;
  if (dur < MIN_BLOCK_MIN) dur = MIN_BLOCK_MIN;
  if (dur > maxEnd - minStart) dur = maxEnd - minStart;
  let start = Math.round(startMin / SNAP_MIN) * SNAP_MIN;
  if (start < minStart) start = minStart;
  if (start + dur > maxEnd) start = maxEnd - dur;
  return { start, duration: dur };
}

export function minToY(min: number): number {
  return ((min - START_HOUR * 60) / 30) * ROW_H;
}

export function yToMin(y: number, snap: number = SNAP_MIN): number {
  const raw = (y / ROW_H) * 30 + START_HOUR * 60;
  return Math.round(raw / snap) * snap;
}

export function fmtDur(min: number): string {
  if (min >= 60) {
    const h = Math.round((min / 60) * 10) / 10;
    return `${h}h`;
  }
  return `${min}m`;
}

export function dayIndexOfDate(date: string, weekStart: string): number {
  const a = parseDate(date).getTime();
  const b = parseDate(weekStart).getTime();
  return Math.round((a - b) / MS_PER_DAY);
}

export function dateForDayIndex(weekStart: string, dayIdx: number): string {
  const d = parseDate(weekStart);
  d.setDate(d.getDate() + dayIdx);
  return formatDate(d);
}
