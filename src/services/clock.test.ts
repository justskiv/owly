import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { now, nowMs, today } from "./clock";

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
});

afterEach(() => {
  vi.useRealTimers();
});

describe("clock", () => {
  it("now() returns the current system time as a Date", () => {
    vi.setSystemTime(new Date("2026-05-11T10:30:45Z"));
    const d = now();
    expect(d).toBeInstanceOf(Date);
    expect(d.getTime()).toBe(Date.parse("2026-05-11T10:30:45Z"));
  });

  it("today() truncates h/m/s/ms to local midnight", () => {
    vi.setSystemTime(new Date("2026-05-11T15:45:30.250Z"));
    const t = today();
    expect(t.getHours()).toBe(0);
    expect(t.getMinutes()).toBe(0);
    expect(t.getSeconds()).toBe(0);
    expect(t.getMilliseconds()).toBe(0);
  });

  it("nowMs() returns now() as an integer epoch", () => {
    const fixed = new Date("2026-05-11T10:00:00Z");
    vi.setSystemTime(fixed);
    expect(nowMs()).toBe(fixed.getTime());
  });
});
