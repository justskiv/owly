import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  errMsg,
  fmtISODateTime,
  fmtShortDate,
  isOverdue,
  pluralRu,
} from "./format";

describe("pluralRu", () => {
  // Russian plural rules: 1, 21, 31 → "one"; 2–4, 22–24 → "few";
  // everything else (0, 5–20, 25–30, ...) → "many". The 11-14 window
  // is a special "many" carve-out that flips the otherwise-"one"/"few"
  // forms — it's the canonical place a naive `n % 10` plural breaks.

  it.each([
    [0, "many"],
    [1, "one"],
    [2, "few"],
    [3, "few"],
    [4, "few"],
    [5, "many"],
    [10, "many"],
    [11, "many"],
    [12, "many"],
    [13, "many"],
    [14, "many"],
    [15, "many"],
    [20, "many"],
    [21, "one"],
    [22, "few"],
    [25, "many"],
    [100, "many"],
    [101, "one"],
    [111, "many"],
    [112, "many"],
    [114, "many"],
    [121, "one"],
    [122, "few"],
  ])("pluralRu(%i) → %s", (n, expected) => {
    expect(pluralRu(n, "one", "few", "many")).toBe(expected);
  });

  it("treats negative numbers symmetrically (abs)", () => {
    expect(pluralRu(-1, "o", "f", "m")).toBe("o");
    expect(pluralRu(-12, "o", "f", "m")).toBe("m");
    expect(pluralRu(-22, "o", "f", "m")).toBe("f");
  });
});

describe("fmtShortDate", () => {
  it("renders YYYY-MM-DD as `D mon` with Russian abbreviated month", () => {
    expect(fmtShortDate("2026-01-05")).toBe("5 янв");
    expect(fmtShortDate("2026-12-31")).toBe("31 дек");
    expect(fmtShortDate("2026-07-09")).toBe("9 июл");
  });
});

describe("fmtISODateTime", () => {
  it("appends `HH:MM` when the input has a time part", () => {
    expect(fmtISODateTime("2026-04-18T09:05:30")).toBe("18 апр, 09:05");
  });

  it("omits the time tail when the input is date-only", () => {
    expect(fmtISODateTime("2026-04-18")).toBe("18 апр");
  });
});

describe("isOverdue", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-05-11T15:00:00"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns true for dates strictly before today", () => {
    expect(isOverdue("2026-05-10")).toBe(true);
    expect(isOverdue("2025-12-31")).toBe(true);
  });

  it("returns false for today itself (compares against midnight)", () => {
    // Boundary: even with current time at 15:00, today's date is NOT
    // overdue. A regression that uses `now()` directly instead of
    // truncating to midnight would surface here.
    expect(isOverdue("2026-05-11")).toBe(false);
  });

  it("returns false for future dates", () => {
    expect(isOverdue("2026-05-12")).toBe(false);
    expect(isOverdue("2027-01-01")).toBe(false);
  });
});

describe("errMsg", () => {
  it("returns Error.message for Error instances", () => {
    expect(errMsg(new Error("boom"))).toBe("boom");
  });

  it("returns the string itself for thrown strings", () => {
    expect(errMsg("plain")).toBe("plain");
  });

  it("falls back to String(e) for non-Error, non-string values", () => {
    expect(errMsg(42)).toBe("42");
    expect(errMsg({ code: "X" })).toBe("[object Object]");
    expect(errMsg(null)).toBe("null");
    expect(errMsg(undefined)).toBe("undefined");
  });
});
