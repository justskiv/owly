import { z } from "zod";

export const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
export const ISO_DATETIME_REGEX = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?$/;
export const TIME_HHMM_REGEX = /^\d{2}:\d{2}$/;
export const MONTH_DAY_REGEX = /^\d{2}-\d{2}$/;
export const WEEK_ID_REGEX = /^\d{4}-w\d{2}$/;

export const isoDate = () => z.string().regex(ISO_DATE_REGEX);
export const isoDateTime = () => z.string().regex(ISO_DATETIME_REGEX);
export const timeHHMM = () => z.string().regex(TIME_HHMM_REGEX);
export const monthDay = () => z.string().regex(MONTH_DAY_REGEX);
export const weekId = () => z.string().regex(WEEK_ID_REGEX);

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
