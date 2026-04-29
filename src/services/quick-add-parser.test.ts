import { describe, expect, it } from "vitest";
import { parseQuickAdd } from "./quick-add-parser";

describe("parseQuickAdd", () => {
  // Local-time 2026-04-29 (month is 0-indexed in Date ctor).
  const base = new Date(2026, 3, 29);

  it("plain title with no modifier", () => {
    expect(parseQuickAdd("Купить молоко", base)).toEqual({
      title: "Купить молоко",
      deadline: null,
    });
  });

  it("!завтра adds one day", () => {
    expect(parseQuickAdd("Купить молоко !завтра", base)).toEqual({
      title: "Купить молоко",
      deadline: "2026-04-30",
    });
  });

  it("!послезавтра adds two days and supports leading position", () => {
    expect(parseQuickAdd("!послезавтра задача", base)).toEqual({
      title: "задача",
      deadline: "2026-05-01",
    });
  });

  it("!послезавтра is not falsely matched as !завтра", () => {
    // The trailing "завтра" inside "!послезавтра" must not slip through
    // when the longer form matches first.
    const r = parseQuickAdd("!послезавтра", base);
    expect(r.deadline).toBe("2026-05-01");
    expect(r.title).toBe("");
  });

  it("!MM.DD uses base year", () => {
    expect(parseQuickAdd("Тест !05.15", base)).toEqual({
      title: "Тест",
      deadline: "2026-05-15",
    });
  });

  it("!YYYY-MM-DD passes through verbatim", () => {
    expect(parseQuickAdd("Тест !2026-12-31", base)).toEqual({
      title: "Тест",
      deadline: "2026-12-31",
    });
  });

  it("only modifier yields empty title", () => {
    expect(parseQuickAdd("!завтра", base)).toEqual({
      title: "",
      deadline: "2026-04-30",
    });
  });

  it("trims and normalizes surrounding whitespace", () => {
    expect(parseQuickAdd("  пробелы  !завтра  ", base)).toEqual({
      title: "пробелы",
      deadline: "2026-04-30",
    });
  });
});
