import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  DOW_HEADERS_RU,
  MONTH_NAMES_RU,
  addDays,
  buildMonthGrid,
  parseIso,
  todayIso,
} from "./calendar-i18n";

describe("constants", () => {
  it("MONTH_NAMES_RU has 12 entries starting Январь", () => {
    expect(MONTH_NAMES_RU).toHaveLength(12);
    expect(MONTH_NAMES_RU[0]).toBe("Январь");
    expect(MONTH_NAMES_RU[11]).toBe("Декабрь");
  });

  it("DOW_HEADERS_RU has 7 entries Mon-first (пн … вс)", () => {
    expect(DOW_HEADERS_RU).toEqual([
      "пн", "вт", "ср", "чт", "пт", "сб", "вс",
    ]);
  });
});

describe("parseIso", () => {
  it("parses YYYY-MM-DD into a local-midnight Date", () => {
    const d = parseIso("2026-05-11");
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(4); // 0-indexed
    expect(d.getDate()).toBe(11);
  });
});

describe("addDays", () => {
  it("adds positive days, crossing month boundaries", () => {
    expect(addDays("2026-04-29", 5)).toBe("2026-05-04");
  });

  it("subtracts when n is negative", () => {
    expect(addDays("2026-05-04", -5)).toBe("2026-04-29");
  });

  it("handles year boundary", () => {
    expect(addDays("2025-12-31", 1)).toBe("2026-01-01");
  });
});

describe("todayIso", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns the local-midnight date for now()", () => {
    vi.setSystemTime(new Date("2026-05-11T15:30:00"));
    expect(todayIso()).toBe("2026-05-11");
  });
});

describe("buildMonthGrid", () => {
  it("always returns 42 cells (6 weeks × 7 days)", () => {
    const grid = buildMonthGrid(2026, 4, "2026-05-11"); // May 2026
    expect(grid).toHaveLength(42);
  });

  it("starts on the Monday of the week containing day 1", () => {
    // May 2026: day 1 is Friday → leading Monday is Apr 27.
    const grid = buildMonthGrid(2026, 4, "2026-05-11");
    expect(grid[0].iso).toBe("2026-04-27");
    expect(grid[0].outOfMonth).toBe(true);
  });

  it("marks isToday only on the cell matching the today arg", () => {
    const grid = buildMonthGrid(2026, 4, "2026-05-11");
    const today = grid.find((g) => g.isToday);
    expect(today?.iso).toBe("2026-05-11");
    expect(grid.filter((g) => g.isToday)).toHaveLength(1);
  });

  it("marks outOfMonth on trailing days that belong to the next month", () => {
    const grid = buildMonthGrid(2026, 4, "2026-05-11"); // May 2026
    // May has 31 days. With the Apr 27 leading edge, position 4 is
    // May 1; trailing cells after May 31 are out-of-month.
    const trailing = grid.slice(-3);
    for (const cell of trailing) {
      expect(cell.outOfMonth).toBe(true);
    }
    const lastInMonth = grid.find((g) => g.iso === "2026-05-31");
    expect(lastInMonth?.outOfMonth).toBe(false);
  });

  it("handles a month starting on Monday with zero leading overflow", () => {
    // June 2026: day 1 is Monday → grid[0] is June 1, in-month.
    const grid = buildMonthGrid(2026, 5, "2026-06-15");
    expect(grid[0].iso).toBe("2026-06-01");
    expect(grid[0].outOfMonth).toBe(false);
  });

  it("handles a month starting on Sunday with 6 leading overflow days", () => {
    // March 2026: day 1 is Sunday → 6 leading days from Feb.
    const grid = buildMonthGrid(2026, 2, "2026-03-15");
    expect(grid[0].iso).toBe("2026-02-23"); // Mon Feb 23
    expect(grid[6].iso).toBe("2026-03-01");
  });
});
