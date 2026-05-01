import { describe, expect, it } from "vitest";
import {
  END_HOUR,
  ROW_H,
  START_HOUR,
  timeToMinutes,
} from "./time-utils";

// Phase 6 grid: 07:00–23:00 × 30-min slots, ROW_H = 40, GRID_H = 1280.
// TimeBlock positions blocks via:
//   top    = (start_min - START_HOUR*60) / 30 * ROW_H
//   height = duration / 30 * ROW_H

function topFor(start: string): number {
  return ((timeToMinutes(start) - START_HOUR * 60) / 30) * ROW_H;
}

function heightFor(durationMin: number): number {
  return (durationMin / 30) * ROW_H;
}

describe("block position formulas", () => {
  it("places start=07:00 at top=0", () => {
    expect(topFor("07:00")).toBe(0);
  });

  it("places start=08:00 at top=2*ROW_H", () => {
    expect(topFor("08:00")).toBe(2 * ROW_H);
  });

  it("places start=07:30 at top=ROW_H", () => {
    expect(topFor("07:30")).toBe(ROW_H);
  });

  it("places start=23:00 at top=GRID_H", () => {
    expect(topFor("23:00")).toBe((END_HOUR - START_HOUR) * 2 * ROW_H);
  });

  it("computes height=80 for duration=60min", () => {
    expect(heightFor(60)).toBe(80);
  });

  it("computes height=40 for duration=30min (min)", () => {
    expect(heightFor(30)).toBe(40);
  });

  it("computes height=120 for duration=90min", () => {
    expect(heightFor(90)).toBe(120);
  });

  it("ROW_H matches 40 (mock §4.2)", () => {
    expect(ROW_H).toBe(40);
  });

  it("START_HOUR is 07 (phase 6 §4.2)", () => {
    expect(START_HOUR).toBe(7);
  });

  it("END_HOUR is 23 (phase 6 §4.2)", () => {
    expect(END_HOUR).toBe(23);
  });
});
