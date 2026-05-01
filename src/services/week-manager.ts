import type { DayOfWeek, Entity, TemplateFile, WeekFile } from "../schemas";
import { TemplateFileSchema } from "../schemas";
import {
  fileExists,
  getDataPath,
  readJsonFile,
  writeJsonFile,
} from "./file-io";
import { EMPTY_TEMPLATE_FILE, emptyWeekFile } from "./defaults";
import {
  addWeeks,
  dateForDayIndex,
  generateId,
  getWeekStartDate,
} from "./time-utils";
import { getCachedWeek, setCachedWeek } from "./week-cache";

const DAY_INDEX: Record<DayOfWeek, number> = {
  mon: 0,
  tue: 1,
  wed: 2,
  thu: 3,
  fri: 4,
  sat: 5,
  sun: 6,
};

export async function weekFileExists(weekId: string): Promise<boolean> {
  const path = await getDataPath("schedule", `${weekId}.json`);
  return fileExists(path);
}

async function readTemplate(): Promise<TemplateFile> {
  const path = await getDataPath("templates", "default.json");
  if (!(await fileExists(path))) {
    await writeJsonFile(path, EMPTY_TEMPLATE_FILE);
    return EMPTY_TEMPLATE_FILE;
  }
  return readJsonFile(path, TemplateFileSchema);
}

export async function createEmptyWeek(weekId: string): Promise<WeekFile> {
  const startDate = getWeekStartDate(weekId);
  const file = emptyWeekFile(weekId, startDate);
  const path = await getDataPath("schedule", `${weekId}.json`);
  await writeJsonFile(path, file);
  setCachedWeek(weekId, file);
  return file;
}

export async function createWeekFromTemplate(
  weekId: string,
): Promise<WeekFile> {
  const template = await readTemplate();
  const startDate = getWeekStartDate(weekId);
  const blocks = template.blocks.map((b) => ({
    id: generateId("blk"),
    title: b.title,
    date: dateForDayIndex(startDate, DAY_INDEX[b.day]),
    start: b.start,
    duration: b.duration,
    category: b.category,
    source_entity_id: null,
    pool_item_id: null,
    status: "planned" as const,
    notes: "",
  }));
  const file: WeekFile = {
    version: 1,
    week: weekId,
    start_date: startDate,
    template_applied: template.name,
    blocks,
  };
  const path = await getDataPath("schedule", `${weekId}.json`);
  await writeJsonFile(path, file);
  setCachedWeek(weekId, file);
  return file;
}

// Returns entities that had a `planned` block in the previous week and
// have no block at all in the current week. Deliberately does NOT look
// at `done`/`skipped` from prev — those have already been resolved.
export async function getCarryOverEntities(
  currentWeekId: string,
  entities: readonly Entity[],
): Promise<Entity[]> {
  const prevId = addWeeks(currentWeekId, -1);
  // Both reads go through the cache — the pool re-runs this on every
  // navigation and on entity changes, so disk hits would add up fast.
  const prev = await getCachedWeek(prevId);
  if (!prev) return [];
  const curr = await getCachedWeek(currentWeekId);

  const prevUndone = new Set<string>();
  for (const b of prev.blocks) {
    if (b.status === "planned" && b.source_entity_id) {
      prevUndone.add(b.source_entity_id);
    }
  }
  const currSources = new Set<string>();
  if (curr) {
    for (const b of curr.blocks) {
      if (b.source_entity_id) currSources.add(b.source_entity_id);
    }
  }

  return entities.filter(
    (e) =>
      prevUndone.has(e.id) && !currSources.has(e.id) && e.status === "active",
  );
}
