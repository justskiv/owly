import { vi } from "vitest";

// Wednesday, ISO 2025-w24, no DST in MSK/US, mid-month. 10:00 falls
// inside ConfigFileSchema's deep-work slot 08:00-13:00.
export const FROZEN_NOW = new Date("2025-06-11T10:00:00");

// Only `Date` is faked — leaving setTimeout/setInterval real keeps
// findBy* retries, userEvent debouncing, and React act() schedulers
// working without explicit `vi.advanceTimersBy` plumbing in every
// test. Tests that need fake timers (e.g. polling intervals) opt in
// locally via `vi.useFakeTimers({ toFake: [...] })`.
export function freezeClock(at: Date = FROZEN_NOW): void {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(at);
}

export function thawClock(): void {
  vi.useRealTimers();
}
