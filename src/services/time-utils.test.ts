import { describe, expect, it } from "vitest";
import {
  addWeeks,
  dateForDayIndex,
  dateToWeekId,
  dayIndexOfDate,
  fmtDur,
  getCurrentWeekId,
  getWeekDates,
  getWeekNumber,
  getWeekStartDate,
} from "./time-utils";

describe("ISO week math", () => {
  describe("getWeekStartDate — Monday of ISO week", () => {
    it.each([
      ["2024-w01", "2024-01-01"],
      ["2025-w01", "2024-12-30"],
      ["2020-w53", "2020-12-28"],
      ["2026-w01", "2025-12-29"],
      ["2026-w53", "2026-12-28"],
      ["2027-w01", "2027-01-04"],
    ])("%s → %s", (weekId, expected) => {
      expect(getWeekStartDate(weekId)).toBe(expected);
    });
  });

  describe("addWeeks", () => {
    it.each([
      ["2025-w52", 1, "2026-w01"],
      ["2026-w01", -1, "2025-w52"],
      ["2020-w52", 1, "2020-w53"],
      ["2020-w53", 1, "2021-w01"],
      ["2026-w52", 1, "2026-w53"],
      ["2026-w53", 1, "2027-w01"],
      ["2024-w26", 4, "2024-w30"],
      ["2024-w26", -26, "2023-w52"],
    ])("%s + %i → %s", (from, delta, expected) => {
      expect(addWeeks(from, delta)).toBe(expected);
    });
  });

  describe("getWeekNumber", () => {
    it.each([
      ["2024-w01", 1],
      ["2020-w53", 53],
      ["2025-w26", 26],
    ])("%s → %i", (weekId, expected) => {
      expect(getWeekNumber(weekId)).toBe(expected);
    });
  });

  describe("getCurrentWeekId", () => {
    it("returns YYYY-wWW format", () => {
      expect(getCurrentWeekId()).toMatch(/^\d{4}-w\d{2}$/);
    });
  });

  describe("getWeekDates — 7 ISO дней", () => {
    it("week 2024-w01 = Mon Jan 1 .. Sun Jan 7", () => {
      expect(getWeekDates("2024-w01")).toEqual([
        "2024-01-01",
        "2024-01-02",
        "2024-01-03",
        "2024-01-04",
        "2024-01-05",
        "2024-01-06",
        "2024-01-07",
      ]);
    });

    it("returns 7 dates", () => {
      expect(getWeekDates("2025-w26")).toHaveLength(7);
    });
  });

  describe("dayIndexOfDate ↔ dateForDayIndex roundtrip", () => {
    it("roundtrip across week", () => {
      const start = "2025-04-21";
      for (let i = 0; i < 7; i++) {
        const date = dateForDayIndex(start, i);
        expect(dayIndexOfDate(date, start)).toBe(i);
      }
    });
  });

  describe("DST edge cases", () => {
    // The Sunday of a DST-week is still 6 days after that week's
    // Monday — the missing/extra hour shouldn't shift the day index.
    it.each([
      // EU spring-forward: Sun Mar 31 2024 (week 13, Mon Mar 25)
      ["2024-03-31", "2024-03-25", 6],
      // EU fall-back: Sun Oct 27 2024
      ["2024-10-27", "2024-10-21", 6],
      // US spring-forward: Sun Mar 10 2024
      ["2024-03-10", "2024-03-04", 6],
      // US fall-back: Sun Nov 3 2024
      ["2024-11-03", "2024-10-28", 6],
    ])("dayIndexOfDate(%s, %s) = %i", (date, weekStart, expected) => {
      expect(dayIndexOfDate(date, weekStart)).toBe(expected);
    });

    it("roundtrip across DST week stays consistent", () => {
      const start = "2024-03-25";
      for (let i = 0; i < 7; i++) {
        const date = dateForDayIndex(start, i);
        expect(dayIndexOfDate(date, start)).toBe(i);
      }
    });
  });

  describe("dateToWeekId", () => {
    it.each([
      ["2024-01-01", "2024-w01"],
      ["2024-12-30", "2025-w01"],
      ["2026-04-14", "2026-w16"],
      ["2020-12-28", "2020-w53"],
      ["2021-01-03", "2020-w53"],
    ])("%s → %s", (date, expected) => {
      expect(dateToWeekId(date)).toBe(expected);
    });
  });
});

describe("fmtDur", () => {
  it.each([
    [15, "15m"],
    [30, "30m"],
    [45, "45m"],
    [60, "1h"],
    [90, "1.5h"],
    [120, "2h"],
    [150, "2.5h"],
    [180, "3h"],
    [75, "1h 15m"],
    [105, "1h 45m"],
    [195, "3h 15m"],
  ])("%i → %s", (min, expected) => {
    expect(fmtDur(min)).toBe(expected);
  });
});
