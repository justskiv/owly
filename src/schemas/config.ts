import { z } from "zod";
import { DayOfWeekSchema, timeHHMM } from "./common";

export const AreaSchema = z.object({
  id: z.string(),
  label: z.string(),
  color: z.string(),
  icon: z.string(),
});
export type Area = z.infer<typeof AreaSchema>;

const HourRangeSchema = z.object({
  start: timeHHMM(),
  end: timeHHMM(),
});

export const SchedulingPreferencesSchema = z.object({
  deep_work_hours: HourRangeSchema,
  no_calls_before: timeHHMM(),
  min_block_duration: z.record(z.string(), z.number().int().positive()),
  buffer_after: z.record(z.string(), z.number().int().nonnegative()),
  hobby_hours: HourRangeSchema,
  max_consecutive_busy_evenings: z.number().int().nonnegative(),
  meeting_preference: z.string(),
  include_travel_time: z.boolean(),
  week_starts_on: DayOfWeekSchema,
});
export type SchedulingPreferences = z.infer<typeof SchedulingPreferencesSchema>;

const PriorityLevelSchema = z.object({
  label: z.string(),
  color: z.string(),
});

export const PriorityConfigSchema = z.object({
  high: PriorityLevelSchema,
  medium: PriorityLevelSchema,
  low: PriorityLevelSchema,
});
export type PriorityConfig = z.infer<typeof PriorityConfigSchema>;

export const ConfigFileSchema = z.object({
  version: z.literal(1),
  areas: z.array(AreaSchema),
  scheduling_preferences: SchedulingPreferencesSchema,
  pipeline_stages: z.array(z.string()),
  priorities: PriorityConfigSchema,
});
export type ConfigFile = z.infer<typeof ConfigFileSchema>;
