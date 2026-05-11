import { describe, expect, it } from "vitest";
import type { MetricHistoryItem } from "../schemas";
import { computeMetricStats } from "./metric-stats";

function h(date: string, value: number): MetricHistoryItem {
  return { date, value };
}

describe("computeMetricStats — empty / degenerate input", () => {
  it("returns zero-shaped result for empty history", () => {
    expect(computeMetricStats([])).toEqual({
      change: 0,
      changePct: 0,
      avgGrowth: 0,
      trend: "flat",
      bars: [],
      sparkline: [],
    });
  });

  it("single point: prev=last so change/avgGrowth are 0 and trend is flat", () => {
    const out = computeMetricStats([h("2026-01-15", 42)]);
    expect(out.change).toBe(0);
    expect(out.changePct).toBe(0);
    expect(out.avgGrowth).toBe(0);
    expect(out.trend).toBe("flat");
    expect(out.sparkline).toEqual([42]);
    expect(out.bars).toEqual([{ label: "Янв", value: 42 }]);
  });
});

describe("computeMetricStats — trend and changePct", () => {
  it("ascending series: trend=up, change=last-prev, changePct positive", () => {
    const out = computeMetricStats([
      h("2026-01-15", 10),
      h("2026-02-15", 20),
    ]);
    expect(out.trend).toBe("up");
    expect(out.change).toBe(10);
    expect(out.changePct).toBe(100);
  });

  it("descending series: trend=down, negative change and changePct", () => {
    const out = computeMetricStats([
      h("2026-01-15", 20),
      h("2026-02-15", 10),
    ]);
    expect(out.trend).toBe("down");
    expect(out.change).toBe(-10);
    expect(out.changePct).toBe(-50);
  });

  it("changePct is 0 (not NaN/Infinity) when prev value is 0", () => {
    // Division-by-zero guard — without it the UI would render
    // "Infinity%" or "NaN%" the first time a metric jumps off 0.
    const out = computeMetricStats([
      h("2026-01-15", 0),
      h("2026-02-15", 5),
    ]);
    expect(out.change).toBe(5);
    expect(out.changePct).toBe(0);
  });

  it("treats sub-epsilon change as flat", () => {
    const out = computeMetricStats([
      h("2026-01-15", 10),
      h("2026-02-15", 10),
    ]);
    expect(out.trend).toBe("flat");
    expect(out.change).toBe(0);
  });
});

describe("computeMetricStats — avgGrowth", () => {
  it("averages per-step delta across the series", () => {
    // values 10, 14, 18, 22 → totalDelta = 12 across 3 steps → 4 each.
    const out = computeMetricStats([
      h("2026-01-15", 10),
      h("2026-02-15", 14),
      h("2026-03-15", 18),
      h("2026-04-15", 22),
    ]);
    expect(out.avgGrowth).toBe(4);
  });
});

describe("computeMetricStats — bars (last-of-month, last 6 months)", () => {
  it("keeps only the final reading per YYYY-MM", () => {
    // Two points in Feb: only the latest one should land in the bar.
    const out = computeMetricStats([
      h("2026-02-01", 5),
      h("2026-02-28", 9),
    ]);
    expect(out.bars).toEqual([{ label: "Фев", value: 9 }]);
  });

  it("caps bars at the most recent 6 months", () => {
    const out = computeMetricStats([
      h("2025-09-15", 1),
      h("2025-10-15", 2),
      h("2025-11-15", 3),
      h("2025-12-15", 4),
      h("2026-01-15", 5),
      h("2026-02-15", 6),
      h("2026-03-15", 7),
      h("2026-04-15", 8),
    ]);
    // Newest 6: Nov..Apr. Sep and Oct fall off the strip.
    expect(out.bars.map((b) => b.label)).toEqual([
      "Ноя", "Дек", "Янв", "Фев", "Мар", "Апр",
    ]);
    expect(out.bars.map((b) => b.value)).toEqual([3, 4, 5, 6, 7, 8]);
  });

  it("handles out-of-order input by sorting first", () => {
    // The store may hand us unsorted history (e.g., a manual edit
    // moved a row). Stats must not depend on insertion order.
    const out = computeMetricStats([
      h("2026-03-01", 30),
      h("2026-01-01", 10),
      h("2026-02-01", 20),
    ]);
    expect(out.sparkline).toEqual([10, 20, 30]);
    expect(out.change).toBe(10); // 30 - 20
  });
});
