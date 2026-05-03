import { describe, expect, it } from "vitest";
import type { HorizonProjectState } from "../schemas";
import {
  classifyProject,
  getHorizonMonths,
  MONTHS_RU_SHORT,
} from "./horizon-helpers";

describe("getHorizonMonths", () => {
  it("returns 8 months starting at baseMonth", () => {
    const m = getHorizonMonths("2026-04-01");
    expect(m).toHaveLength(8);
    expect(m[0]).toEqual({ label: "Апр", isCurrent: true });
    expect(m[1]).toEqual({ label: "Май", isCurrent: false });
    expect(m[7]).toEqual({ label: "Ноя", isCurrent: false });
  });

  it("wraps year boundary (Nov base → Jan/Feb next year)", () => {
    const m = getHorizonMonths("2026-11-01");
    expect(m[0].label).toBe("Ноя");
    expect(m[1].label).toBe("Дек");
    expect(m[2].label).toBe("Янв");
    expect(m[3].label).toBe("Фев");
  });

  it("January base produces sequential months without wrap", () => {
    const m = getHorizonMonths("2026-01-01");
    expect(m.map((x) => x.label)).toEqual([
      "Янв", "Фев", "Мар", "Апр", "Май", "Июн", "Июл", "Авг",
    ]);
  });

  it("first month is always isCurrent", () => {
    expect(getHorizonMonths("2026-06-01")[0].isCurrent).toBe(true);
    expect(getHorizonMonths("2026-06-01")[1].isCurrent).toBe(false);
  });

  it("labels come from MONTHS_RU_SHORT lookup", () => {
    const m = getHorizonMonths("2026-04-01");
    for (const x of m) {
      expect(MONTHS_RU_SHORT).toContain(x.label);
    }
  });
});

describe("classifyProject", () => {
  const base: HorizonProjectState = {
    project_id: "p1",
    months: [],
    size: "mid",
    hidden: false,
  };

  it("hidden → deferred regardless of months", () => {
    expect(classifyProject({ ...base, hidden: true })).toBe("deferred");
    expect(classifyProject({ ...base, hidden: true, months: [0, 1] })).toBe(
      "deferred",
    );
  });

  it("not hidden + has months → active", () => {
    expect(classifyProject({ ...base, months: [0] })).toBe("active");
    expect(classifyProject({ ...base, months: [3, 4, 5] })).toBe("active");
  });

  it("not hidden + no months → someday", () => {
    expect(classifyProject(base)).toBe("someday");
  });
});
