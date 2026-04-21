import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  ConfigFileSchema,
  EntitiesFileSchema,
  TemplateFileSchema,
  WeekFileSchema,
  type Block,
  type Entity,
  type EntitiesFile,
  type TemplateFile,
  type WeekFile,
} from "../src/schemas";
import { DEFAULT_CONFIG } from "../src/services/defaults";
import {
  getCurrentWeekId,
  getWeekDates,
  getWeekStartDate,
  nowISO,
} from "../src/services/time-utils";

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const dataDir = path.join(projectRoot, "data");

function shortId(prefix: string, n: number): string {
  return `${prefix}-${String(n).padStart(4, "0")}`;
}

async function ensureDir(p: string): Promise<void> {
  await fs.mkdir(p, { recursive: true });
}

async function writeJson(filePath: string, data: unknown): Promise<void> {
  await ensureDir(path.dirname(filePath));
  await fs.writeFile(filePath, JSON.stringify(data, null, 2), "utf8");
}

const NOW = nowISO();

const entities: Entity[] = [
  {
    id: shortId("ent", 1),
    type: "project",
    title: "Видео: GC Deep Dive",
    tags: ["work", "growth"],
    status: "active",
    priority: "high",
    deadline: "2026-04-25",
    estimated_minutes: 600,
    created_at: NOW,
    updated_at: NOW,
    fields: {
      description: "Глубокое видео про Garbage Collector в Go",
      pipeline_stage: "production",
      task_ids: [shortId("ent", 3), shortId("ent", 4)],
    },
  },
  {
    id: shortId("ent", 2),
    type: "project",
    title: "Подкаст эпизод #45",
    tags: ["work", "people"],
    status: "active",
    priority: "medium",
    deadline: "2026-04-30",
    estimated_minutes: 480,
    created_at: NOW,
    updated_at: NOW,
    fields: {
      description: "Запись подкаста с приглашённым гостем",
      pipeline_stage: "research",
      task_ids: [],
    },
  },
  {
    id: shortId("ent", 3),
    type: "task",
    title: "Записать интро GC Deep Dive",
    tags: ["work"],
    status: "active",
    priority: "high",
    deadline: "2026-04-15",
    estimated_minutes: 60,
    created_at: NOW,
    updated_at: NOW,
    fields: {
      parent_project_id: shortId("ent", 1),
      checklist: [
        { text: "Накидать тезисы", done: true },
        { text: "Записать черновик", done: false },
        { text: "Финальный дубль", done: false },
      ],
    },
  },
  {
    id: shortId("ent", 4),
    type: "task",
    title: "Монтаж GC Deep Dive",
    tags: ["work"],
    status: "active",
    priority: "high",
    deadline: "2026-04-22",
    estimated_minutes: 240,
    created_at: NOW,
    updated_at: NOW,
    fields: {
      parent_project_id: shortId("ent", 1),
      checklist: [],
    },
  },
  {
    id: shortId("ent", 5),
    type: "task",
    title: "Купить корм собакам",
    tags: ["life"],
    status: "active",
    priority: "medium",
    deadline: "2026-04-16",
    estimated_minutes: 30,
    created_at: NOW,
    updated_at: NOW,
    fields: { parent_project_id: null, checklist: [] },
  },
  {
    id: shortId("ent", 6),
    type: "routine",
    title: "Собаки утро",
    tags: ["health", "life"],
    status: "active",
    priority: null,
    deadline: null,
    estimated_minutes: 30,
    created_at: NOW,
    updated_at: NOW,
    fields: {
      frequency: "daily",
      days: [],
      default_duration: 30,
      default_time: "07:00",
    },
  },
  {
    id: shortId("ent", 7),
    type: "routine",
    title: "Завтрак",
    tags: ["health"],
    status: "active",
    priority: null,
    deadline: null,
    estimated_minutes: 30,
    created_at: NOW,
    updated_at: NOW,
    fields: {
      frequency: "daily",
      days: [],
      default_duration: 30,
      default_time: "07:30",
    },
  },
  {
    id: shortId("ent", 8),
    type: "routine",
    title: "Японский",
    tags: ["growth"],
    status: "active",
    priority: null,
    deadline: null,
    estimated_minutes: 30,
    created_at: NOW,
    updated_at: NOW,
    fields: {
      frequency: "weekly",
      days: ["mon", "wed", "fri"],
      default_duration: 30,
      default_time: "08:00",
    },
  },
  {
    id: shortId("ent", 9),
    type: "event",
    title: "Созвон с Андреем",
    tags: ["work", "people"],
    status: "active",
    priority: "medium",
    deadline: null,
    estimated_minutes: 60,
    created_at: NOW,
    updated_at: NOW,
    fields: {
      date: getWeekDates(getCurrentWeekId())[1],
      time: "14:00",
      duration: 60,
      location: "Zoom",
      travel_time: 0,
    },
  },
  {
    id: shortId("ent", 10),
    type: "contact",
    title: "Мама",
    tags: ["people", "life"],
    status: "active",
    priority: null,
    deadline: null,
    estimated_minutes: null,
    created_at: NOW,
    updated_at: NOW,
    fields: {
      name: "Мама",
      desired_cadence_days: 7,
      last_contact: "2026-04-06",
      travel_time: 40,
      important_dates: [{ label: "День рождения", date: "03-15" }],
      notes: "Любит когда звоню, а не пишу",
    },
  },
  {
    id: shortId("ent", 11),
    type: "contact",
    title: "Андрей",
    tags: ["work", "people"],
    status: "active",
    priority: null,
    deadline: null,
    estimated_minutes: null,
    created_at: NOW,
    updated_at: NOW,
    fields: {
      name: "Андрей",
      desired_cadence_days: 14,
      last_contact: "2026-04-01",
      travel_time: 0,
      important_dates: [],
      notes: "Коллега по подкасту",
    },
  },
  {
    id: shortId("ent", 12),
    type: "goal",
    title: "55K подписчиков YouTube",
    tags: ["work", "growth"],
    status: "active",
    priority: "high",
    deadline: "2026-12-31",
    estimated_minutes: null,
    created_at: NOW,
    updated_at: NOW,
    fields: {
      target: "55 000 подписчиков на YouTube",
      current_value: "33 000",
      target_date: "2026-12-31",
    },
  },
  {
    id: shortId("ent", 13),
    type: "note",
    title: "Идеи для новых видео",
    tags: ["work"],
    status: "active",
    priority: null,
    deadline: null,
    estimated_minutes: null,
    created_at: NOW,
    updated_at: NOW,
    fields: {
      body:
        "- Видео про concurrency в Go\n" +
        "- Стрим с разбором кода open-source\n" +
        "- Гайд по профайлингу",
    },
  },
  {
    id: shortId("ent", 14),
    type: "metric",
    title: "YouTube subscribers",
    tags: ["work"],
    status: "active",
    priority: null,
    deadline: null,
    estimated_minutes: null,
    created_at: NOW,
    updated_at: NOW,
    fields: {
      unit: "subscribers",
      current_value: 33000,
      history: [
        { date: "2026-02-01", value: 30200 },
        { date: "2026-03-01", value: 31500 },
        { date: "2026-04-01", value: 33000 },
      ],
    },
  },
  {
    id: shortId("ent", 15),
    type: "task",
    title: "Прочитать книгу про дизайн систем",
    tags: ["growth"],
    status: "someday",
    priority: "low",
    deadline: null,
    estimated_minutes: 720,
    created_at: NOW,
    updated_at: NOW,
    fields: { parent_project_id: null, checklist: [] },
  },
];

const template: TemplateFile = {
  version: 1,
  name: "default",
  description: "Обычная рабочая неделя",
  blocks: [
    { day: "mon", start: "07:00", duration: 30, title: "Собаки утро", category: "health" },
    { day: "mon", start: "07:30", duration: 30, title: "Завтрак", category: "health" },
    { day: "mon", start: "08:00", duration: 30, title: "Японский", category: "growth" },
    { day: "tue", start: "07:00", duration: 30, title: "Собаки утро", category: "health" },
    { day: "tue", start: "07:30", duration: 30, title: "Завтрак", category: "health" },
    { day: "wed", start: "07:00", duration: 30, title: "Собаки утро", category: "health" },
    { day: "wed", start: "07:30", duration: 30, title: "Завтрак", category: "health" },
    { day: "wed", start: "08:00", duration: 30, title: "Японский", category: "growth" },
    { day: "fri", start: "08:00", duration: 30, title: "Японский", category: "growth" },
    { day: "sat", start: "10:00", duration: 60, title: "Уборка", category: "life" },
  ],
};

const week = getCurrentWeekId();
const weekStart = getWeekStartDate(week);
const dates = getWeekDates(week);

const seedBlocks: Omit<Block, "id">[] = [
  // понедельник
  { title: "Собаки утро", date: dates[0], start: "07:00", duration: 30, category: "health", source_entity_id: null, status: "planned", notes: "" },
  { title: "Завтрак", date: dates[0], start: "07:30", duration: 30, category: "health", source_entity_id: null, status: "planned", notes: "" },
  { title: "Японский", date: dates[0], start: "08:00", duration: 30, category: "growth", source_entity_id: null, status: "planned", notes: "" },
  { title: "Монтаж GC Deep Dive", date: dates[0], start: "09:00", duration: 120, category: "work", source_entity_id: shortId("ent", 4), status: "planned", notes: "" },
  // вторник
  { title: "Собаки утро", date: dates[1], start: "07:00", duration: 30, category: "health", source_entity_id: null, status: "planned", notes: "" },
  { title: "Завтрак", date: dates[1], start: "07:30", duration: 30, category: "health", source_entity_id: null, status: "planned", notes: "" },
  { title: "Записать интро GC Deep Dive", date: dates[1], start: "09:00", duration: 60, category: "work", source_entity_id: shortId("ent", 3), status: "planned", notes: "" },
  { title: "Созвон с Андреем", date: dates[1], start: "14:00", duration: 60, category: "work", source_entity_id: shortId("ent", 9), status: "planned", notes: "" },
  // среда
  { title: "Собаки утро", date: dates[2], start: "07:00", duration: 30, category: "health", source_entity_id: null, status: "planned", notes: "" },
  { title: "Завтрак", date: dates[2], start: "07:30", duration: 30, category: "health", source_entity_id: null, status: "planned", notes: "" },
  { title: "Японский", date: dates[2], start: "08:00", duration: 30, category: "growth", source_entity_id: null, status: "planned", notes: "" },
  { title: "Ресёрч для подкаста", date: dates[2], start: "10:00", duration: 90, category: "work", source_entity_id: shortId("ent", 2), status: "planned", notes: "" },
  // четверг
  { title: "Собаки утро", date: dates[3], start: "07:00", duration: 30, category: "health", source_entity_id: null, status: "planned", notes: "" },
  { title: "Завтрак", date: dates[3], start: "07:30", duration: 30, category: "health", source_entity_id: null, status: "planned", notes: "" },
  { title: "Монтаж GC Deep Dive", date: dates[3], start: "09:00", duration: 180, category: "work", source_entity_id: shortId("ent", 4), status: "planned", notes: "" },
  { title: "Купить корм собакам", date: dates[3], start: "18:00", duration: 30, category: "life", source_entity_id: shortId("ent", 5), status: "planned", notes: "" },
  // пятница
  { title: "Собаки утро", date: dates[4], start: "07:00", duration: 30, category: "health", source_entity_id: null, status: "planned", notes: "" },
  { title: "Завтрак", date: dates[4], start: "07:30", duration: 30, category: "health", source_entity_id: null, status: "planned", notes: "" },
  { title: "Японский", date: dates[4], start: "08:00", duration: 30, category: "growth", source_entity_id: null, status: "planned", notes: "" },
  { title: "Звонок маме", date: dates[4], start: "19:00", duration: 30, category: "people", source_entity_id: shortId("ent", 10), status: "planned", notes: "" },
  // суббота
  { title: "Уборка", date: dates[5], start: "10:00", duration: 60, category: "life", source_entity_id: null, status: "planned", notes: "" },
  { title: "Прогулка с собаками", date: dates[5], start: "14:00", duration: 90, category: "life", source_entity_id: null, status: "planned", notes: "" },
  // воскресенье
  { title: "Чтение", date: dates[6], start: "11:00", duration: 60, category: "growth", source_entity_id: null, status: "planned", notes: "" },
  { title: "Прогулка с собаками", date: dates[6], start: "16:00", duration: 60, category: "life", source_entity_id: null, status: "planned", notes: "" },
  { title: "Планирование недели", date: dates[6], start: "20:00", duration: 30, category: "work", source_entity_id: null, status: "planned", notes: "" },
];

const blocks: Block[] = seedBlocks.map((b, idx) => ({
  ...b,
  id: shortId("blk", idx + 1),
}));

const entitiesFile: EntitiesFile = { version: 1, entities };
const weekFile: WeekFile = {
  version: 1,
  week,
  start_date: weekStart,
  template_applied: "default",
  blocks,
};

async function main() {
  // Валидация через Zod до записи
  ConfigFileSchema.parse(DEFAULT_CONFIG);
  EntitiesFileSchema.parse(entitiesFile);
  TemplateFileSchema.parse(template);
  WeekFileSchema.parse(weekFile);

  await ensureDir(dataDir);
  await ensureDir(path.join(dataDir, "schedule"));
  await ensureDir(path.join(dataDir, "templates"));
  await ensureDir(path.join(dataDir, "dashboards"));

  await writeJson(path.join(dataDir, "config.json"), DEFAULT_CONFIG);
  await writeJson(path.join(dataDir, "entities.json"), entitiesFile);
  await writeJson(path.join(dataDir, "templates", "default.json"), template);
  await writeJson(path.join(dataDir, "schedule", `${week}.json`), weekFile);

  console.log(
    `Seeded:\n` +
      `  config.json — 5 областей\n` +
      `  entities.json — ${entities.length} сущностей\n` +
      `  templates/default.json — ${template.blocks.length} блоков\n` +
      `  schedule/${week}.json — ${blocks.length} блоков`,
  );
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
