import type {
  ConfigFile,
  EntitiesFile,
  TemplateFile,
  WeekFile,
} from "../schemas";

export const DEFAULT_CONFIG: ConfigFile = {
  version: 1,
  areas: [
    { id: "work", label: "Работа", color: "#3B82F6", icon: "briefcase" },
    { id: "people", label: "Люди", color: "#EC4899", icon: "users" },
    { id: "life", label: "Быт", color: "#F59E0B", icon: "home" },
    { id: "growth", label: "Развитие", color: "#8B5CF6", icon: "book" },
    { id: "health", label: "Здоровье", color: "#10B981", icon: "heart" },
  ],
  scheduling_preferences: {
    deep_work_hours: { start: "08:00", end: "13:00" },
    no_calls_before: "11:00",
    min_block_duration: { editing: 120, research: 90, default: 30 },
    buffer_after: { podcast_recording: 60 },
    hobby_hours: { start: "19:00", end: "22:00" },
    max_consecutive_busy_evenings: 2,
    meeting_preference: "weekends",
    include_travel_time: true,
    week_starts_on: "mon",
  },
  pipeline_stages: [
    "research",
    "production",
    "editing",
    "review",
    "publishing",
    "done",
  ],
  priorities: {
    high: { label: "Высокий", color: "#EF4444" },
    medium: { label: "Средний", color: "#F59E0B" },
    low: { label: "Низкий", color: "#6B7280" },
  },
};

export const EMPTY_ENTITIES_FILE: EntitiesFile = {
  version: 1,
  entities: [],
};

export const EMPTY_TEMPLATE_FILE: TemplateFile = {
  version: 1,
  name: "default",
  description: "",
  blocks: [],
};

export function emptyWeekFile(week: string, startDate: string): WeekFile {
  return {
    version: 1,
    week,
    start_date: startDate,
    template_applied: null,
    blocks: [],
  };
}
