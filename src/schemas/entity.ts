import { z } from "zod";
import { DayOfWeekSchema, isoDate, isoDateTime, monthDay, timeHHMM } from "./common";

export const EntityTypeSchema = z.enum([
  "task",
  "project",
  "routine",
  "event",
  "contact",
  "goal",
  "note",
  "metric",
  "direction",
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
  checklist: z.array(ChecklistItemSchema).default([]),
});
export type TaskFields = z.infer<typeof TaskFieldsSchema>;

// Historical fixed set of pipeline stages — retained only to drive
// the localisation table in PIPELINE_LABELS_RU. The schema itself uses
// z.string() because users can add/remove stages in Settings, and the
// enum would otherwise reject any entity referencing a custom stage.
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
  description: z.string().default(""),
  pipeline_stage: z.string().default("research"),
  task_ids: z.array(z.string()).default([]),
  // v2 fields
  direction_id: z.string().nullable().default(null),
  board_id: z.string().default("brd3"),
  column_index: z.number().int().nonnegative().default(0),
  last_activity_days: z.number().int().nonnegative().default(0),
});
export type ProjectFields = z.infer<typeof ProjectFieldsSchema>;

export const RoutineFrequencySchema = z.enum(["daily", "weekly", "custom"]);
export type RoutineFrequency = z.infer<typeof RoutineFrequencySchema>;

export const RoutineFieldsSchema = z.object({
  frequency: RoutineFrequencySchema,
  days: z.array(DayOfWeekSchema),
  default_duration: z.number().int().positive(),
  default_time: timeHHMM(),
});
export type RoutineFields = z.infer<typeof RoutineFieldsSchema>;

export const EventFieldsSchema = z.object({
  date: isoDate(),
  time: timeHHMM(),
  duration: z.number().int().positive(),
  location: z.string().default(""),
  travel_time: z.number().int().nonnegative().default(0),
});
export type EventFields = z.infer<typeof EventFieldsSchema>;

export const ImportantDateSchema = z.object({
  label: z.string(),
  date: monthDay(),
  // Per-row emoji (🎂 / 💐 / 🤝 / etc.) so important-date rows can
  // visually differ in ContactDetail. Defaults to 📅 so older files
  // migrate without losing data.
  icon: z.string().default("📅"),
});
export type ImportantDate = z.infer<typeof ImportantDateSchema>;

export const ContactTopicSchema = z.object({
  text: z.string(),
  done: z.boolean(),
});
export type ContactTopic = z.infer<typeof ContactTopicSchema>;

export const ContactHistoryItemSchema = z.object({
  date: isoDate(),
  note: z.string(),
});
export type ContactHistoryItem = z.infer<typeof ContactHistoryItemSchema>;

export const ContactFieldsSchema = z.object({
  name: z.string().default(""),
  desired_cadence_days: z.number().int().positive().nullable().default(null),
  last_contact: isoDate().nullable().default(null),
  travel_time: z.number().int().nonnegative().default(0),
  important_dates: z.array(ImportantDateSchema).default([]),
  topics: z.array(ContactTopicSchema).default([]),
  contact_history: z.array(ContactHistoryItemSchema).default([]),
  notes: z.string().default(""),
});
export type ContactFields = z.infer<typeof ContactFieldsSchema>;

export const GoalFieldsSchema = z.object({
  target: z.string(),
  current_value: z.string(),
  target_date: isoDate().nullable(),
  linked_metric_ids: z.array(z.string()).default([]),
});
export type GoalFields = z.infer<typeof GoalFieldsSchema>;

export const NoteFieldsSchema = z.object({
  body: z.string(),
});
export type NoteFields = z.infer<typeof NoteFieldsSchema>;

export const MetricHistoryItemSchema = z.object({
  date: isoDate(),
  value: z.number(),
});
export type MetricHistoryItem = z.infer<typeof MetricHistoryItemSchema>;

export const MetricFieldsSchema = z.object({
  unit: z.string().default(""),
  current_value: z.number().default(0),
  linked_goal_id: z.string().nullable().default(null),
  history: z.array(MetricHistoryItemSchema).default([]),
});
export type MetricFields = z.infer<typeof MetricFieldsSchema>;

export const DirectionFieldsSchema = z.object({
  // Measurable (optional)
  target: z.string().nullable().default(null),
  current: z.string().nullable().default(null),
  progress: z.number().min(0).max(100).nullable().default(null),
  // Cadence (optional)
  cadence: z.number().int().positive().nullable().default(null),
  last_act: isoDate().nullable().default(null),
  cadence_label: z.string().nullable().default(null),
});
export type DirectionFields = z.infer<typeof DirectionFieldsSchema>;

const baseEntityShape = {
  id: z.string(),
  title: z.string(),
  tags: z.array(z.string()),
  status: StatusSchema,
  priority: PrioritySchema,
  deadline: isoDate().nullable(),
  estimated_minutes: z.number().int().positive().nullable(),
  description: z.string().default(""),
  // Strict YYYY-MM-DDTHH:MM[:SS] (no TZ suffix) — matches the format
  // produced by nowISO(). A toISOString() result with `Z` suffix
  // would silently round-trip through z.string() and break ordering /
  // comparison code that expects the canonical shape.
  created_at: isoDateTime(),
  updated_at: isoDateTime(),
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
  z.object({
    type: z.literal("direction"),
    ...baseEntityShape,
    fields: DirectionFieldsSchema,
  }),
]);
export type Entity = z.infer<typeof EntitySchema>;

export type TaskEntity = Extract<Entity, { type: "task" }>;
export type ProjectEntity = Extract<Entity, { type: "project" }>;
export type RoutineEntity = Extract<Entity, { type: "routine" }>;
export type EventEntity = Extract<Entity, { type: "event" }>;
export type ContactEntity = Extract<Entity, { type: "contact" }>;
export type GoalEntity = Extract<Entity, { type: "goal" }>;
export type NoteEntity = Extract<Entity, { type: "note" }>;
export type MetricEntity = Extract<Entity, { type: "metric" }>;
export type DirectionEntity = Extract<Entity, { type: "direction" }>;

export const EntitiesFileSchema = z.object({
  version: z.literal(1),
  entities: z.array(EntitySchema),
});
export type EntitiesFile = z.infer<typeof EntitiesFileSchema>;
