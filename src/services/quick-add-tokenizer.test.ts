import { describe, expect, it } from "vitest";
import { isConflict, tokenize, tokensToParsed } from "./quick-add-tokenizer";

// Local-time 2026-04-29 (Wednesday). Month is 0-indexed in Date ctor.
const BASE_WED = new Date(2026, 3, 29);
// 2026-06-01 (Monday) — used for past-date kicker on !05.15.
const BASE_JUN_1 = new Date(2026, 5, 1);
// 2026-04-27 (Monday) — to verify "!пн" on Monday jumps +7.
const BASE_MON = new Date(2026, 3, 27);
// 2026-04-26 (Sunday) — for weekend edge.
const BASE_SUN = new Date(2026, 3, 26);

describe("tokenize", () => {
  it("plain title yields one text token", () => {
    const tokens = tokenize("Купить молоко", BASE_WED);
    expect(tokens).toHaveLength(1);
    expect(tokens[0]).toMatchObject({
      type: "text",
      start: 0,
      end: 13,
      raw: "Купить молоко",
    });
  });

  it("!завтра adds one day with humanLabel", () => {
    const tokens = tokenize("Купить молоко !завтра", BASE_WED);
    expect(tokens).toHaveLength(2);
    expect(tokens[0]).toMatchObject({ type: "text", raw: "Купить молоко " });
    expect(tokens[1]).toMatchObject({
      type: "date-modifier",
      raw: "!завтра",
      deadline: "2026-04-30",
    });
    expect(tokens[1].humanLabel).toContain("завтра");
  });

  it("!послезавтра as leading position", () => {
    const tokens = tokenize("!послезавтра задача", BASE_WED);
    expect(tokens).toHaveLength(2);
    expect(tokens[0]).toMatchObject({
      type: "date-modifier",
      raw: "!послезавтра",
      deadline: "2026-05-01",
    });
    expect(tokens[1]).toMatchObject({ type: "text", raw: " задача" });
  });

  it("!послезавтра is not falsely matched as !завтра", () => {
    const tokens = tokenize("!послезавтра", BASE_WED);
    expect(tokens).toHaveLength(1);
    expect(tokens[0]).toMatchObject({
      type: "date-modifier",
      deadline: "2026-05-01",
    });
  });

  it("!DD.MM uses base year and produces date-modifier", () => {
    const tokens = tokenize("Тест !15.05", BASE_WED);
    expect(tokens).toHaveLength(2);
    expect(tokens[1]).toMatchObject({
      type: "date-modifier",
      deadline: "2026-05-15",
    });
  });

  it("!DD.MM in the past produces date-modifier-past", () => {
    const tokens = tokenize("Тест !15.05", BASE_JUN_1);
    expect(tokens).toHaveLength(2);
    expect(tokens[1]).toMatchObject({
      type: "date-modifier-past",
      deadline: "2026-05-15",
    });
  });

  it("invalid !DD.MM produces date-modifier-invalid (no deadline)", () => {
    // 13 is a valid day but 40 is not a valid month — caught by the
    // Date roundtrip validator.
    const tokens = tokenize("Тест !13.40", BASE_WED);
    expect(tokens).toHaveLength(2);
    expect(tokens[1]).toMatchObject({ type: "date-modifier-invalid" });
    expect(tokens[1].deadline).toBeUndefined();
  });

  it("ISO YYYY-MM-DD produces date-modifier", () => {
    const tokens = tokenize("Тест !2026-12-31", BASE_WED);
    expect(tokens).toHaveLength(2);
    expect(tokens[1]).toMatchObject({
      type: "date-modifier",
      deadline: "2026-12-31",
    });
  });

  it("two date modifiers — both returned", () => {
    const tokens = tokenize("!завтра !послезавтра", BASE_WED);
    expect(tokens).toHaveLength(3);
    expect(tokens[0]).toMatchObject({
      type: "date-modifier",
      deadline: "2026-04-30",
    });
    expect(tokens[1]).toMatchObject({ type: "text", raw: " " });
    expect(tokens[2]).toMatchObject({
      type: "date-modifier",
      deadline: "2026-05-01",
    });
  });

  it("!пн from Wednesday → next Monday (+5 days)", () => {
    const tokens = tokenize("!пн", BASE_WED);
    expect(tokens).toHaveLength(1);
    expect(tokens[0]).toMatchObject({
      type: "date-modifier",
      deadline: "2026-05-04",
    });
  });

  it("!пн on Monday → next Monday (+7 days, NOT today)", () => {
    const tokens = tokenize("!пн", BASE_MON);
    expect(tokens).toHaveLength(1);
    expect(tokens[0]).toMatchObject({
      type: "date-modifier",
      deadline: "2026-05-04",
    });
  });

  it("!через неделю → +7 days", () => {
    const tokens = tokenize("!через неделю", BASE_WED);
    expect(tokens).toHaveLength(1);
    expect(tokens[0]).toMatchObject({
      type: "date-modifier",
      deadline: "2026-05-06",
    });
  });

  it("!через месяц → +30 days", () => {
    const tokens = tokenize("!через месяц", BASE_WED);
    expect(tokens).toHaveLength(1);
    expect(tokens[0]).toMatchObject({
      type: "date-modifier",
      deadline: "2026-05-29",
    });
  });

  it("!tomorrow alias → +1 day", () => {
    const tokens = tokenize("!tomorrow", BASE_WED);
    expect(tokens).toHaveLength(1);
    expect(tokens[0]).toMatchObject({
      type: "date-modifier",
      deadline: "2026-04-30",
    });
  });

  it("'завтра' without bang stays a literal text token", () => {
    const tokens = tokenize("завтра договориться", BASE_WED);
    expect(tokens).toHaveLength(1);
    expect(tokens[0]).toMatchObject({ type: "text" });
  });

  it("modifier without left whitespace boundary is ignored", () => {
    const tokens = tokenize("привет!завтра", BASE_WED);
    expect(tokens).toHaveLength(1);
    expect(tokens[0]).toMatchObject({ type: "text", raw: "привет!завтра" });
  });

  it("modifier without right whitespace boundary is ignored", () => {
    const tokens = tokenize("!завтра!", BASE_WED);
    expect(tokens).toHaveLength(1);
    expect(tokens[0]).toMatchObject({ type: "text", raw: "!завтра!" });
  });

  it("preserves whitespace spans around modifiers", () => {
    const tokens = tokenize("  пробелы  !завтра  ", BASE_WED);
    expect(tokens).toHaveLength(3);
    expect(tokens[0]).toMatchObject({ type: "text", raw: "  пробелы  " });
    expect(tokens[1]).toMatchObject({ type: "date-modifier", raw: "!завтра" });
    expect(tokens[2]).toMatchObject({ type: "text", raw: "  " });
  });

  it("!завтра alone covers full input span", () => {
    const tokens = tokenize("!завтра", BASE_WED);
    expect(tokens).toHaveLength(1);
    expect(tokens[0]).toMatchObject({
      type: "date-modifier",
      start: 0,
      end: 7,
    });
  });

  it("empty input → empty array", () => {
    expect(tokenize("", BASE_WED)).toEqual([]);
  });

  it("!вс on Sunday → next Sunday (+7)", () => {
    const tokens = tokenize("!вс", BASE_SUN);
    expect(tokens).toHaveLength(1);
    expect(tokens[0]).toMatchObject({
      type: "date-modifier",
      deadline: "2026-05-03",
    });
  });

  it("!пн on Sunday → tomorrow (+1)", () => {
    const tokens = tokenize("!пн", BASE_SUN);
    expect(tokens).toHaveLength(1);
    expect(tokens[0]).toMatchObject({
      type: "date-modifier",
      deadline: "2026-04-27",
    });
  });
});

describe("tokensToParsed", () => {
  it("text only — title preserved, deadline null", () => {
    const tokens = tokenize("Купить молоко", BASE_WED);
    expect(tokensToParsed(tokens, new Set())).toEqual({
      title: "Купить молоко",
      deadline: null,
    });
  });

  it("text + date-modifier → title without modifier, deadline set", () => {
    const tokens = tokenize("Купить молоко !завтра", BASE_WED);
    expect(tokensToParsed(tokens, new Set())).toEqual({
      title: "Купить молоко",
      deadline: "2026-04-30",
    });
  });

  it("two date modifiers — last one wins", () => {
    const tokens = tokenize("!завтра !послезавтра", BASE_WED);
    expect(tokensToParsed(tokens, new Set())).toEqual({
      title: "",
      deadline: "2026-05-01",
    });
  });

  it("deactivated date-modifier kept in title, deadline null", () => {
    const tokens = tokenize("Тест !завтра", BASE_WED);
    const span = `${tokens[1].start}-${tokens[1].end}`;
    expect(tokensToParsed(tokens, new Set([span]))).toEqual({
      title: "Тест !завтра",
      deadline: null,
    });
  });

  it("invalid date-modifier is cut from title, no deadline", () => {
    const tokens = tokenize("Тест !13.40", BASE_WED);
    expect(tokensToParsed(tokens, new Set())).toEqual({
      title: "Тест",
      deadline: null,
    });
  });

  it("deactivated invalid date-modifier stays in title as literal", () => {
    const tokens = tokenize("Тест !13.40", BASE_WED);
    const span = `${tokens[1].start}-${tokens[1].end}`;
    expect(tokensToParsed(tokens, new Set([span]))).toEqual({
      title: "Тест !13.40",
      deadline: null,
    });
  });

  it("past date-modifier still produces deadline", () => {
    const tokens = tokenize("Тест !15.05", BASE_JUN_1);
    expect(tokensToParsed(tokens, new Set())).toEqual({
      title: "Тест",
      deadline: "2026-05-15",
    });
  });
});

describe("isConflict", () => {
  it("no modifiers — no conflict", () => {
    const tokens = tokenize("Купить молоко", BASE_WED);
    expect(isConflict(tokens, new Set())).toBe(false);
  });

  it("single valid modifier — no conflict", () => {
    const tokens = tokenize("Тест !завтра", BASE_WED);
    expect(isConflict(tokens, new Set())).toBe(false);
  });

  it("two valid modifiers — conflict", () => {
    const tokens = tokenize("!завтра !послезавтра", BASE_WED);
    expect(isConflict(tokens, new Set())).toBe(true);
  });

  it("valid + past — conflict (both count as date)", () => {
    const tokens = tokenize("!завтра !15.05", BASE_JUN_1);
    expect(isConflict(tokens, new Set())).toBe(true);
  });

  it("valid + invalid — no conflict (invalid is parse-error)", () => {
    const tokens = tokenize("!завтра !13.40", BASE_WED);
    expect(isConflict(tokens, new Set())).toBe(false);
  });

  it("two valid but one deactivated — no conflict", () => {
    const tokens = tokenize("!завтра !послезавтра", BASE_WED);
    const span = `${tokens[0].start}-${tokens[0].end}`;
    expect(isConflict(tokens, new Set([span]))).toBe(false);
  });

  it("three valid — conflict", () => {
    const tokens = tokenize("!завтра !пн !через неделю", BASE_WED);
    expect(isConflict(tokens, new Set())).toBe(true);
  });

  it("two invalid only — no conflict", () => {
    const tokens = tokenize("!13.40 !99.99", BASE_WED);
    expect(isConflict(tokens, new Set())).toBe(false);
  });
});
