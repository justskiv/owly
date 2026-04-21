import { z } from "zod";
import { DayOfWeekSchema, isoDate, monthDay, timeHHMM } from "./common";

export const EntityTypeSchema = z.enum([
  "task",
  "project",
  "routine",
  "event",
  "contact",
  "goal",
  "note",
  "metric",
]);
export type EntityType = z.infer<typeof EntityTypeSchema>;

export const StatusSchema = z.enum(["active", "done", "archived", "someday"]);
export type Status = z.infer<typeof StatusSchema>;

export const PrioritySchema = z.enum(["high", "medium", "low"]).nullable();
export type Priority = z.infer<typeof PrioritySchema>;

export const ChecklistItemSchema = z.object({
  text: z.string(),
  done: z.boolean(),
});
export type ChecklistItem = z.infer<typeof ChecklistItemSchema>;

export const TaskFieldsSchema = z.object({
  parent_project_id: z.string().nullable(),
  checklist: z.array(ChecklistItemSchema),
});

export const PipelineStageSchema = z.enum([
  "research",
  "production",
  "editing",
  "review",
  "publishing",
  "done",
]);
export type PipelineStage = z.infer<typeof PipelineStageSchema>;

export const ProjectFieldsSchema = z.object({
  description: z.string(),
  pipeline_stage: PipelineStageSchema,
  task_ids: z.array(z.string()),
});

export const RoutineFrequencySchema = z.enum(["daily", "weekly", "custom"]);
export type RoutineFrequency = z.infer<typeof RoutineFrequencySchema>;

export const RoutineFieldsSchema = z.object({
  frequency: RoutineFrequencySchema,
  days: z.array(DayOfWeekSchema),
  default_duration: z.number().int().positive(),
  default_time: timeHHMM(),
});

export const EventFieldsSchema = z.object({
  date: isoDate(),
  time: timeHHMM(),
  duration: z.number().int().positive(),
  location: z.string(),
  travel_time: z.number().int().nonnegative(),
});

export const ImportantDateSchema = z.object({
  label: z.string(),
  date: monthDay(),
});

export const ContactFieldsSchema = z.object({
  name: z.string(),
  desired_cadence_days: z.number().int().positive().nullable(),
  last_contact: isoDate().nullable(),
  travel_time: z.number().int().nonnegative(),
  important_dates: z.array(ImportantDateSchema),
  notes: z.string(),
});

export const GoalFieldsSchema = z.object({
  target: z.string(),
  current_value: z.string(),
  target_date: isoDate().nullable(),
});

export const NoteFieldsSchema = z.object({
  body: z.string(),
});

export const MetricHistoryItemSchema = z.object({
  date: isoDate(),
  value: z.number(),
});

export const MetricFieldsSchema = z.object({
  unit: z.string(),
  current_value: z.number(),
  history: z.array(MetricHistoryItemSchema),
});

const baseEntityShape = {
  id: z.string(),
  title: z.string(),
  tags: z.array(z.string()),
  status: StatusSchema,
  priority: PrioritySchema,
  deadline: isoDate().nullable(),
  estimated_minutes: z.number().int().positive().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
};

export const EntitySchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("task"),
    ...baseEntityShape,
    fields: TaskFieldsSchema,
  }),
  z.object({
    type: z.literal("project"),
    ...baseEntityShape,
    fields: ProjectFieldsSchema,
  }),
  z.object({
    type: z.literal("routine"),
    ...baseEntityShape,
    fields: RoutineFieldsSchema,
  }),
  z.object({
    type: z.literal("event"),
    ...baseEntityShape,
    fields: EventFieldsSchema,
  }),
  z.object({
    type: z.literal("contact"),
    ...baseEntityShape,
    fields: ContactFieldsSchema,
  }),
  z.object({
    type: z.literal("goal"),
    ...baseEntityShape,
    fields: GoalFieldsSchema,
  }),
  z.object({
    type: z.literal("note"),
    ...baseEntityShape,
    fields: NoteFieldsSchema,
  }),
  z.object({
    type: z.literal("metric"),
    ...baseEntityShape,
    fields: MetricFieldsSchema,
  }),
]);
export type Entity = z.infer<typeof EntitySchema>;

export const EntitiesFileSchema = z.object({
  version: z.literal(1),
  entities: z.array(EntitySchema),
});
export type EntitiesFile = z.infer<typeof EntitiesFileSchema>;
