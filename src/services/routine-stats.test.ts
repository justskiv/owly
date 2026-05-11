import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const fs = new Map<string, string>();

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(
    async (cmd: string, args?: { path?: string }) => {
      const a = args ?? {};
      switch (cmd) {
        case "get_data_dir":
          return "/data";
        case "file_exists":
          return fs.has(a.path ?? "");
        case "read_file": {
          const v = fs.get(a.path ?? "");
          if (v === undefined) throw new Error(`ENOENT: ${a.path}`);
          return v;
        }
        default:
          return undefined;
      }
    },
  ),
}));

import type { Block } from "../schemas";
import { now } from "./clock";
import { __resetDataDirCacheForTests } from "./file-io";
import { clearWeekCache } from "./week-cache";
import { computeRoutineStats } from "./routine-stats";
import { addWeeks, formatDate, getCurrentWeekId, getWeekStartDate } from "./time-utils";

const ROUTINE_ID = "r1";

function block(
  date: string,
  opts: { id?: string; status?: Block["status"]; sourceEntityId?: string | null } = {},
): Block {
  return {
    id: opts.id ?? `blk-${date}`,
    title: "morning routine",
    date,
    start: "08:00",
    duration: 30,
    category: "health",
    source_entity_id: opts.sourceEntityId === undefined ? ROUTINE_ID : opts.sourceEntityId,
    pool_item_id: null,
    status: opts.status ?? "planned",
    notes: "",
  };
}

function plantWeek(weekId: string, blocks: Block[]): void {
  const path = `/data/schedule/${weekId}.json`;
  fs.set(
    path,
    JSON.stringify({
      version: 1,
      week: weekId,
      start_date: getWeekStartDate(weekId),
      template_applied: null,
      blocks,
    }),
  );
}

function isoFromOffset(daysAgo: number): string {
  const d = now();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - daysAgo);
  return formatDate(d);
}

beforeEach(() => {
  fs.clear();
  __resetDataDirCacheForTests();
  clearWeekCache();
  // Pin "today" to a Wednesday so the streak/rate tests have a stable
  // weekday — Wed has 2 days before it inside the current week, which
  // is enough to demonstrate streak walks across week boundaries.
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-05-13T12:00:00")); // Wed
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("computeRoutineStats — empty / no matches", () => {
  it("returns zero-shaped stats when no week files exist", async () => {
    const out = await computeRoutineStats(ROUTINE_ID);
    expect(out.streak).toBe(0);
    expect(out.rate).toBe(0);
    expect(out.weekDone).toEqual([false, false, false, false, false, false, false]);
    // 26 weeks of empty heatmap cells, each with 7 days at level 0.
    expect(out.heatmap).toHaveLength(26);
    for (const w of out.heatmap) {
      expect(w.days).toHaveLength(7);
      expect(w.days.every((d) => d.level === 0)).toBe(true);
    }
  });

  it("ignores blocks belonging to a different routine", async () => {
    const today = isoFromOffset(0);
    plantWeek(getCurrentWeekId(), [
      block(today, { sourceEntityId: "other-routine", status: "done" }),
    ]);
    const out = await computeRoutineStats(ROUTINE_ID);
    expect(out.streak).toBe(0);
    expect(out.rate).toBe(0);
  });
});

describe("computeRoutineStats — weekDone (current week Mon..Sun)", () => {
  it("marks days that have any done block for the routine", async () => {
    const curr = getCurrentWeekId();
    const monday = getWeekStartDate(curr);
    const dates = (() => {
      const out: string[] = [];
      for (let i = 0; i < 7; i++) {
        const d = new Date(`${monday}T00:00:00`);
        d.setDate(d.getDate() + i);
        out.push(formatDate(d));
      }
      return out;
    })();
    // Done on Mon and Wed; planned on Fri (not done → false).
    plantWeek(curr, [
      block(dates[0], { id: "b-mon", status: "done" }),
      block(dates[2], { id: "b-wed", status: "done" }),
      block(dates[4], { id: "b-fri", status: "planned" }),
    ]);
    const out = await computeRoutineStats(ROUTINE_ID);
    expect(out.weekDone).toEqual([true, false, true, false, false, false, false]);
  });
});

describe("computeRoutineStats — streak", () => {
  it("counts consecutive done days ending today, allowing today to be empty", async () => {
    const curr = getCurrentWeekId();
    // System time is Wed; plant `done` for yesterday (Tue) and the
    // day before (Mon), nothing for today. Empty-today must NOT zero
    // the streak — it's allowed to be the start-of-day morning view.
    plantWeek(curr, [
      block(isoFromOffset(1), { id: "b-yest", status: "done" }),
      block(isoFromOffset(2), { id: "b-d2", status: "done" }),
    ]);
    const out = await computeRoutineStats(ROUTINE_ID);
    expect(out.streak).toBe(2);
  });

  it("breaks the streak at the first miss day", async () => {
    const curr = getCurrentWeekId();
    plantWeek(curr, [
      block(isoFromOffset(0), { id: "b-today", status: "done" }),
      // Day-1 missing entirely — counts as a break.
      block(isoFromOffset(2), { id: "b-old", status: "done" }),
    ]);
    const out = await computeRoutineStats(ROUTINE_ID);
    expect(out.streak).toBe(1);
  });

  it("walks across the previous week's file", async () => {
    const curr = getCurrentWeekId();
    const prev = addWeeks(curr, -1);
    // Today is Wed; plant done Mon..Wed of current week + Thu..Sun of
    // prev week so the streak spans the boundary.
    const days = [0, 1, 2, 3, 4, 5, 6];
    plantWeek(curr, days.slice(0, 3).map((n) =>
      block(isoFromOffset(n), { id: `c-${n}`, status: "done" }),
    ));
    plantWeek(prev, days.slice(3, 7).map((n) =>
      block(isoFromOffset(n), { id: `p-${n}`, status: "done" }),
    ));
    const out = await computeRoutineStats(ROUTINE_ID);
    expect(out.streak).toBe(7);
  });
});

describe("computeRoutineStats — rate (30-day done %)", () => {
  it("computes done / (done + miss) over the last 30 days, today excluded if empty", async () => {
    // Plant 6 done days and 4 miss days across last 30 days; today
    // empty → excluded from denominator. Expected: 6 / (6+4) = 60%.
    const curr = getCurrentWeekId();
    const prev = addWeeks(curr, -1);
    const planted: Block[] = [];
    const prevPlanted: Block[] = [];
    for (let i = 1; i <= 6; i++) {
      planted.push(
        block(isoFromOffset(i), { id: `done-${i}`, status: "done" }),
      );
    }
    for (let i = 7; i <= 10; i++) {
      planted.push(
        block(isoFromOffset(i), { id: `miss-${i}`, status: "skipped" }),
      );
    }
    plantWeek(curr, planted.filter((b) => {
      const d = new Date(`${b.date}T00:00:00`);
      const start = new Date(`${getWeekStartDate(curr)}T00:00:00`);
      return d.getTime() >= start.getTime();
    }));
    plantWeek(prev, planted.filter((b) => {
      const d = new Date(`${b.date}T00:00:00`);
      const start = new Date(`${getWeekStartDate(curr)}T00:00:00`);
      return d.getTime() < start.getTime();
    }).concat(prevPlanted));
    const out = await computeRoutineStats(ROUTINE_ID);
    expect(out.rate).toBe(60);
  });

  it("returns 0 when there is no done/miss data in the last 30 days", async () => {
    const out = await computeRoutineStats(ROUTINE_ID);
    expect(out.rate).toBe(0);
  });
});

describe("computeRoutineStats — heatmap", () => {
  it("levels saturate at 4+ done blocks in a day", async () => {
    // Doubled-up routine: 5 done blocks on the same date should not
    // exceed level 4 (the heatmap is meant for a glanceable strip).
    const today = isoFromOffset(0);
    plantWeek(getCurrentWeekId(),
      [0, 1, 2, 3, 4].map((i) =>
        block(today, { id: `b-${i}`, status: "done" }),
      ),
    );
    const out = await computeRoutineStats(ROUTINE_ID);
    const todayCell = out.heatmap[25].days.find((d) => d.date === today);
    expect(todayCell?.level).toBe(4);
  });

  it("level scales 0..4 by done count", async () => {
    const curr = getCurrentWeekId();
    // Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4 done blocks.
    const monday = getWeekStartDate(curr);
    const dates = (() => {
      const out: string[] = [];
      for (let i = 0; i < 5; i++) {
        const d = new Date(`${monday}T00:00:00`);
        d.setDate(d.getDate() + i);
        out.push(formatDate(d));
      }
      return out;
    })();
    const blocks: Block[] = [];
    for (let day = 1; day <= 4; day++) {
      for (let n = 0; n < day; n++) {
        blocks.push(block(dates[day], { id: `${day}-${n}`, status: "done" }));
      }
    }
    plantWeek(curr, blocks);
    const out = await computeRoutineStats(ROUTINE_ID);
    const lastWeek = out.heatmap[25].days;
    expect(lastWeek[0].level).toBe(0);
    expect(lastWeek[1].level).toBe(1);
    expect(lastWeek[2].level).toBe(2);
    expect(lastWeek[3].level).toBe(3);
    expect(lastWeek[4].level).toBe(4);
  });
});
