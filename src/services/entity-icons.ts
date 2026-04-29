import type {
  EntityType,
  PipelineStage,
  Priority,
  Status,
} from "../schemas";

export const ENTITY_ICONS: Record<EntityType, string> = {
  task: "📋",
  project: "📁",
  routine: "🔄",
  event: "📅",
  contact: "👤",
  goal: "🎯",
  metric: "📈",
  note: "📝",
  direction: "🧭",
};

export const ENTITY_LABELS_RU: Record<EntityType, string> = {
  task: "Задача",
  project: "Проект",
  routine: "Рутина",
  event: "Событие",
  contact: "Контакт",
  goal: "Цель",
  metric: "Метрика",
  note: "Заметка",
  direction: "Направление",
};

export const ENTITY_PLURAL_RU: Record<EntityType, string> = {
  task: "Задачи",
  project: "Проекты",
  routine: "Рутины",
  event: "События",
  contact: "Контакты",
  goal: "Цели",
  metric: "Метрики",
  note: "Заметки",
  direction: "Направления",
};

export const ENTITY_LABELS_ACC: Record<EntityType, string> = {
  task: "задачу",
  project: "проект",
  routine: "рутину",
  event: "событие",
  contact: "контакт",
  goal: "цель",
  metric: "метрику",
  note: "заметку",
  direction: "направление",
};

export const STATUS_LABELS_RU: Record<Status, string> = {
  active: "Active",
  someday: "Someday",
  done: "Done",
  archived: "Archived",
};

export const PRIORITY_LABELS_RU: Record<NonNullable<Priority>, string> = {
  high: "HIGH",
  medium: "MEDIUM",
  low: "LOW",
};

export const PIPELINE_LABELS_RU: Record<PipelineStage, string> = {
  research: "Ресёрч",
  production: "Продакшн",
  editing: "Монтаж",
  review: "Ревью",
  publishing: "Публик.",
  done: "Готово",
};

// Filter tabs on Entities page — event intentionally not listed, per
// spec: single event per UI would clutter, and event blocks live on
// the planner grid anyway.
export const ENTITY_FILTER_TYPES: EntityType[] = [
  "task",
  "project",
  "routine",
  "contact",
  "goal",
  "metric",
  "note",
  "direction",
];

// All types shown in the "+ Создать" dropdown — here event IS included.
export const ENTITY_CREATE_TYPES: EntityType[] = [
  "task",
  "project",
  "routine",
  "event",
  "contact",
  "goal",
  "metric",
  "note",
  "direction",
];
