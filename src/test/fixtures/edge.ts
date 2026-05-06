import { ConfigFileSchema } from "../../schemas/config";
import { EntitySchema } from "../../schemas/entity";
import { HorizonFileSchema } from "../../schemas/horizon";
import { BlockSchema } from "../../schemas/schedule";

export const edgeAreas = [
  { id: "life", label: "Жизнь", color: "#B8D84A", icon: "home" },
  { id: "work", label: "Работа", color: "#FF7A3D", icon: "briefcase" },
];

export const edgeConfig = ConfigFileSchema.parse({
  version: 1,
  areas: edgeAreas,
  scheduling_preferences: {
    deep_work_hours: { start: "08:00", end: "13:00" },
    no_calls_before: "11:00",
    min_block_duration: { default: 30 },
    buffer_after: {},
    hobby_hours: { start: "19:00", end: "22:00" },
    max_consecutive_busy_evenings: 2,
    meeting_preference: "weekends",
    include_travel_time: true,
    week_starts_on: "mon",
  },
  pipeline_stages: ["research", "production", "done"],
  priorities: {
    high: { label: "Высокий", color: "#E06878" },
    medium: { label: "Средний", color: "#C78A3A" },
    low: { label: "Низкий", color: "#707070" },
  },
});

const NOW = "2026-05-04T10:00";

export const edgeTask = EntitySchema.parse({
  id: "ent-task-1",
  type: "task",
  title: "Existing task",
  tags: ["life"],
  status: "active",
  priority: "medium",
  deadline: null,
  estimated_minutes: null,
  description: "",
  created_at: NOW,
  updated_at: NOW,
  fields: { parent_project_id: null },
});

export const edgeProject = EntitySchema.parse({
  id: "ent-proj-1",
  type: "project",
  title: "Existing project",
  tags: ["work"],
  status: "active",
  priority: null,
  deadline: null,
  estimated_minutes: null,
  description: "",
  created_at: NOW,
  updated_at: NOW,
  fields: {},
});

export const edgeDirection = EntitySchema.parse({
  id: "ent-dir-1",
  type: "direction",
  title: "Existing direction",
  tags: ["life"],
  status: "active",
  priority: null,
  deadline: null,
  estimated_minutes: null,
  description: "",
  created_at: NOW,
  updated_at: NOW,
  fields: {},
});

export const edgeEntities = [edgeTask, edgeProject, edgeDirection];

export const edgeHorizonFile = HorizonFileSchema.parse({
  version: 1,
  base_month: "2026-05-01",
  projects: [
    {
      project_id: edgeProject.id,
      months: [4, 5, 6],
      size: "mid",
      hidden: false,
    },
  ],
});

// Monday of ISO week 2026-W19. Tuesday is 2026-05-05 — drop target
// for the DnD smoke. Both dates are static so the test is reproducible
// regardless of when it runs.
export const edgeBlock = BlockSchema.parse({
  id: "edge-block-1",
  title: "Smoke block",
  date: "2026-05-04",
  start: "10:00",
  duration: 60,
  category: "life",
  source_entity_id: null,
  status: "planned",
  notes: "",
});

export const edgeWeekState = {
  currentWeek: "2026-w19",
  startDate: "2026-05-04",
  templateApplied: null,
  blocks: [edgeBlock],
  loading: false,
  error: null,
};

// Screenshot baseline must not flip groups or "Xд" text day-to-day,
// so all tasks have null deadlines — they land in the "someday"
// group and render without an urgency chip.
export const screenshotEntities = [
  EntitySchema.parse({
    id: "shot-task-1",
    type: "task",
    title: "Daily routine review",
    tags: ["life"],
    status: "active",
    priority: "medium",
    deadline: null,
    estimated_minutes: null,
    description: "",
    created_at: NOW,
    updated_at: NOW,
    fields: { parent_project_id: null },
  }),
  EntitySchema.parse({
    id: "shot-task-2",
    type: "task",
    title: "Read research paper",
    tags: ["work"],
    status: "active",
    priority: "high",
    deadline: null,
    estimated_minutes: null,
    description: "",
    created_at: NOW,
    updated_at: NOW,
    fields: { parent_project_id: null },
  }),
  EntitySchema.parse({
    id: "shot-task-3",
    type: "task",
    title: "Refactor planner gesture hook",
    tags: ["work"],
    status: "active",
    priority: "low",
    deadline: null,
    estimated_minutes: null,
    description: "",
    created_at: NOW,
    updated_at: NOW,
    fields: { parent_project_id: null },
  }),
];
