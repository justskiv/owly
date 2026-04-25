import { z } from "zod";

export const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
export const ISO_DATETIME_REGEX = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?$/;
export const TIME_HHMM_REGEX = /^\d{2}:\d{2}$/;
export const MONTH_DAY_REGEX = /^\d{2}-\d{2}$/;
export const WEEK_ID_REGEX = /^\d{4}-w\d{2}$/;

// Refines accept the regex shape but reject impossible calendar
// values. Without these, `2026-99-99` / `99:99` / `13-32` slip past
// Zod and poison computations downstream — heatmap math, deadline
// comparisons, etc. The format-only regex was load-bearing too long.

function isValidYMD(y: number, m: number, d: number): boolean {
  if (m < 1 || m > 12 || d < 1 || d > 31) return false;
  const date = new Date(Date.UTC(y, m - 1, d));
  return (
    date.getUTCFullYear() === y &&
    date.getUTCMonth() === m - 1 &&
    date.getUTCDate() === d
  );
}

export const isoDate = () =>
  z
    .string()
    .regex(ISO_DATE_REGEX, "expected YYYY-MM-DD")
    .refine((s) => {
      const [y, m, d] = s.split("-").map(Number);
      return isValidYMD(y, m, d);
    }, "not a real calendar date");

export const isoDateTime = () =>
  z
    .string()
    .regex(ISO_DATETIME_REGEX, "expected YYYY-MM-DDTHH:MM[:SS]")
    .refine((s) => {
      const [datePart, timePart] = s.split("T");
      const [y, mo, d] = datePart.split("-").map(Number);
      if (!isValidYMD(y, mo, d)) return false;
      const [h, mi] = timePart.split(":").map(Number);
      return h >= 0 && h <= 23 && mi >= 0 && mi <= 59;
    }, "not a real calendar timestamp");

export const timeHHMM = () =>
  z
    .string()
    .regex(TIME_HHMM_REGEX, "expected HH:MM")
    .refine((s) => {
      const [h, m] = s.split(":").map(Number);
      return h >= 0 && h <= 23 && m >= 0 && m <= 59;
    }, "hour must be 00-23, minute 00-59");

export const monthDay = () =>
  z
    .string()
    .regex(MONTH_DAY_REGEX, "expected MM-DD")
    .refine((s) => {
      const [m, d] = s.split("-").map(Number);
      // Use a leap year so Feb 29 is accepted as a valid important
      // date — anniversaries on Feb 29 are a real thing.
      return isValidYMD(2024, m, d);
    }, "not a real month/day");

export const weekId = () =>
  z
    .string()
    .regex(WEEK_ID_REGEX, "expected YYYY-wNN")
    .refine((s) => {
      const m = /^(\d{4})-w(\d{2})$/.exec(s);
      if (!m) return false;
      const w = Number(m[2]);
      // ISO weeks run 01..53; 53 only exists for "long" years but
      // we accept the upper bound rather than computing per-year.
      return w >= 1 && w <= 53;
    }, "ISO week must be 01-53");

export const DayOfWeekSchema = z.enum([
  "mon",
  "tue",
  "wed",
  "thu",
  "fri",
  "sat",
  "sun",
]);
export type DayOfWeek = z.infer<typeof DayOfWeekSchema>;
