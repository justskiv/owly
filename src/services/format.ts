import { now } from "./clock";

export function pluralRu(
  n: number,
  one: string,
  few: string,
  many: string,
): string {
  const abs = Math.abs(n);
  const mod10 = abs % 10;
  const mod100 = abs % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
  return many;
}

const MONTHS_SHORT_RU = [
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

export function fmtShortDate(iso: string): string {
  const [, m, d] = iso.split("-").map((p) => parseInt(p, 10));
  return `${d} ${MONTHS_SHORT_RU[m - 1]}`;
}

export function fmtISODateTime(iso: string): string {
  // "2026-04-18T09:05:30" → "18 апр, 09:05"
  const datePart = iso.slice(0, 10);
  const timePart = iso.length > 10 ? iso.slice(11, 16) : "";
  return timePart
    ? `${fmtShortDate(datePart)}, ${timePart}`
    : fmtShortDate(datePart);
}

export function isOverdue(isoDate: string): boolean {
  const today = now();
  today.setHours(0, 0, 0, 0);
  const d = new Date(`${isoDate}T00:00:00`);
  return d.getTime() < today.getTime();
}

// Safe error-message extractor for `unknown` catches. Replaces the
// scattered `(e as Error).message` casts that throw on a non-Error
// rejection (string thrown, number, plain object). Use everywhere
// outside test files, where casts are controlled.
export function errMsg(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (typeof e === "string") return e;
  return String(e);
}
