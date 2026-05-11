import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ContactFields } from "../schemas";
import { computeContactStats } from "./contact-stats";

function contactFields(
  patch: Partial<ContactFields>,
): ContactFields {
  return {
    name: "X",
    desired_cadence_days: null,
    last_contact: null,
    travel_time: 0,
    important_dates: [],
    topics: [],
    contact_history: [],
    notes: "",
    ...patch,
  };
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-05-11T10:00:00Z"));
});

afterEach(() => {
  vi.useRealTimers();
});

describe("computeContactStats", () => {
  it("returns state=unknown when last_contact is missing", () => {
    expect(
      computeContactStats(
        contactFields({ desired_cadence_days: 14, last_contact: null }),
      ),
    ).toEqual({
      state: "unknown",
      overdueDays: 0,
      nextInDays: 0,
      lastContact: null,
      cadence: 14,
    });
  });

  it("returns state=unknown when cadence is missing", () => {
    expect(
      computeContactStats(
        contactFields({
          desired_cadence_days: null,
          last_contact: "2026-05-01",
        }),
      ),
    ).toEqual({
      state: "unknown",
      overdueDays: 0,
      nextInDays: 0,
      lastContact: "2026-05-01",
      cadence: null,
    });
  });

  it("returns ok with nextInDays when within cadence", () => {
    // Last contact 5 days ago, cadence 14 → next contact in 9 days.
    const out = computeContactStats(
      contactFields({
        desired_cadence_days: 14,
        last_contact: "2026-05-06",
      }),
    );
    expect(out.state).toBe("ok");
    expect(out.overdueDays).toBe(0);
    expect(out.nextInDays).toBe(9);
  });

  it("returns ok with nextInDays=0 when due exactly today", () => {
    // Boundary: exactly cadence days have passed — still "ok" (diff===0).
    // Catches an off-by-one slip in the > comparator.
    const out = computeContactStats(
      contactFields({
        desired_cadence_days: 10,
        last_contact: "2026-05-01",
      }),
    );
    expect(out.state).toBe("ok");
    // The code computes `-diff` which yields `-0` when diff is 0;
    // `===` collapses ±0, `toBe` (Object.is) does not.
    expect(out.nextInDays === 0).toBe(true);
    expect(out.overdueDays).toBe(0);
  });

  it("returns overdue when more than cadence days have passed", () => {
    // 20 days since last, cadence 14 → 6 days overdue.
    const out = computeContactStats(
      contactFields({
        desired_cadence_days: 14,
        last_contact: "2026-04-21",
      }),
    );
    expect(out.state).toBe("overdue");
    expect(out.overdueDays).toBe(6);
    expect(out.nextInDays).toBe(0);
  });
});
