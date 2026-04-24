import type { Block, WeekFile } from "../schemas";
import { WeekFileSchema } from "../schemas";
import { fileExists, getDataPath, readJsonFile } from "./file-io";
import {
  addWeeks,
  formatDate,
  getCurrentWeekId,
  getWeekStartDate,
} from "./time-utils";

export interface HeatmapDay {
  date: string;
  level: 0 | 1 | 2 | 3 | 4;
}

export interface HeatmapWeek {
  // Month label for the column header row. Non-null only for the first
  // week in a new calendar month — that's enough to render the Janу /
  // Фев / ... strip from the mock.
  monthLabel: string | null;
  days: HeatmapDay[]; // always 7, Mon..Sun
}

export interface RoutineStats {
  streak: number;
  rate: number; // 0..100, done / (done + skipped) over last 30 days
  weekDone: boolean[]; // 7 entries for current week Mon..Sun
  heatmap: HeatmapWeek[]; // last 26 weeks, oldest → newest
}

const MONTHS_RU = [
  "Янв",
  "Фев",
  "Мар",
  "Апр",
  "Май",
  "Июн",
  "Июл",
  "Авг",
  "Сен",
  "Окт",
  "Ноя",
  "Дек",
];
const HEATMAP_WEEKS = 26;

function doneLevelFor(count: number): HeatmapDay["level"] {
  if (count <= 0) return 0;
  if (count === 1) return 1;
  if (count === 2) return 2;
  if (count === 3) return 3;
  return 4;
}

// Reads a week file if it exists; returns [] if not. Shields stats
// computation from missing history — fresh installs have no past weeks.
async function tryReadWeekBlocks(weekId: string): Promise<Block[]> {
  const path = await getDataPath("schedule", `${weekId}.json`);
  if (!(await fileExists(path))) return [];
  try {
    const file: WeekFile = await readJsonFile(path, WeekFileSchema);
    return file.blocks;
  } catch (e) {
    // Corrupt files are rare but shouldn't crash routine detail.
    console.warn(`[routine-stats] skip ${weekId}: ${(e as Error).message}`);
    return [];
  }
}

export async function computeRoutineStats(
  routineId: string,
): Promise<RoutineStats> {
  const currentWeek = getCurrentWeekId();

  // Collect all week files in range [today - 26 weeks, today]. We
  // could list all schedule/*.json and parse, but the bounded loop is
  // simpler and keeps irrelevant weeks out of stats entirely.
  const weekIds: string[] = [];
  for (let i = HEATMAP_WEEKS - 1; i >= 0; i--) {
    weekIds.push(addWeeks(currentWeek, -i));
  }

  // Map `date → Block[]` across all weeks, filtered to this routine.
  const byDate = new Map<string, Block[]>();
  await Promise.all(
    weekIds.map(async (wid) => {
      const blocks = await tryReadWeekBlocks(wid);
      for (const b of blocks) {
        if (b.source_entity_id !== routineId) continue;
        const arr = byDate.get(b.date);
        if (arr) arr.push(b);
        else byDate.set(b.date, [b]);
      }
    }),
  );

  // Build heatmap: for each week in range, 7 day-cells.
  const heatmap: HeatmapWeek[] = weekIds.map((wid) => {
    const start = getWeekStartDate(wid);
    let monthLabel: string | null = null;
    const days: HeatmapDay[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(`${start}T00:00:00`);
      d.setDate(d.getDate() + i);
      const iso = formatDate(d);
      const blocks = byDate.get(iso) ?? [];
      const doneCount = blocks.filter((b) => b.status === "done").length;
      days.push({ date: iso, level: doneLevelFor(doneCount) });
      if (monthLabel == null && d.getDate() <= 7) {
        // Cheap heuristic: this week contains the first week of a new
        // month if day-of-month ≤ 7 — we label the first such day.
        // Works well for the 13px-per-week strip in the mock.
        monthLabel = MONTHS_RU[d.getMonth()];
      }
    }
    return { monthLabel, days };
  });

  // weekDone for the current week:
  const currStart = getWeekStartDate(currentWeek);
  const weekDone: boolean[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(`${currStart}T00:00:00`);
    d.setDate(d.getDate() + i);
    const iso = formatDate(d);
    const blocks = byDate.get(iso) ?? [];
    weekDone.push(blocks.some((b) => b.status === "done"));
  }

  // Streak: count consecutive days ending today (inclusive) that had a
  // done block. The streak breaks on the first day with no done block.
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  let streak = 0;
  for (let offset = 0; offset < 365; offset++) {
    const d = new Date(today);
    d.setDate(today.getDate() - offset);
    const iso = formatDate(d);
    const blocks = byDate.get(iso) ?? [];
    const hasDone = blocks.some((b) => b.status === "done");
    if (hasDone) {
      streak++;
    } else {
      // Allow today itself to be "empty" without zeroing the streak —
      // the user might not have done the routine yet today.
      if (offset === 0) continue;
      break;
    }
  }

  // Rate: over the last 30 days, done / (done + skipped). Planned but
  // expired days (before today with no done) count as skipped for the
  // purposes of ratio — they indicate a miss.
  let doneCount = 0;
  let missCount = 0;
  for (let offset = 0; offset < 30; offset++) {
    const d = new Date(today);
    d.setDate(today.getDate() - offset);
    const iso = formatDate(d);
    const blocks = byDate.get(iso) ?? [];
    if (blocks.length === 0) continue;
    const anyDone = blocks.some((b) => b.status === "done");
    if (anyDone) doneCount++;
    else missCount++;
  }
  const rateBase = doneCount + missCount;
  const rate =
    rateBase > 0 ? Math.round((doneCount / rateBase) * 100) : 0;

  return { streak, rate, weekDone, heatmap };
}
