import { describe, expect, it } from "vitest";
import {
  cadUrgClass,
  daysSince,
  daysUntil,
  formatDeadline,
  urgClass,
} from "./urgency";

const APR29 = new Date(2026, 3, 29);

describe("daysUntil", () => {
  it("returns null for null input", () => {
    expect(daysUntil(null, APR29)).toBe(null);
  });

  it("returns 0 for today", () => {
    expect(daysUntil("2026-04-29", APR29)).toBe(0);
  });

  it("returns 1 for tomorrow", () => {
    expect(daysUntil("2026-04-30", APR29)).toBe(1);
  });

  it("returns negative for past", () => {
    expect(daysUntil("2026-04-25", APR29)).toBe(-4);
  });

  it("ignores time-of-day in `today`", () => {
    const lateNight = new Date(2026, 3, 29, 23, 59, 59);
    expect(daysUntil("2026-04-30", lateNight)).toBe(1);
  });

  it("returns null for malformed ISO", () => {
    expect(daysUntil("not-a-date", APR29)).toBe(null);
  });
});

describe("urgClass", () => {
  it("empty for null", () => {
    expect(urgClass(null)).toBe("");
  });

  it("bad for overdue", () => {
    expect(urgClass(-1)).toBe("urgency-bad");
    expect(urgClass(-30)).toBe("urgency-bad");
  });

  it("bad for 0..3", () => {
    expect(urgClass(0)).toBe("urgency-bad");
    expect(urgClass(3)).toBe("urgency-bad");
  });

  it("warn for 4..7", () => {
    expect(urgClass(4)).toBe("urgency-warn");
    expect(urgClass(7)).toBe("urgency-warn");
  });

  it("ok for 8+", () => {
    expect(urgClass(8)).toBe("urgency-ok");
    expect(urgClass(365)).toBe("urgency-ok");
  });
});

describe("formatDeadline", () => {
  it("сегодня for 0", () => {
    expect(formatDeadline(0)).toBe("сегодня");
  });

  it("Nд for positive", () => {
    expect(formatDeadline(1)).toBe("1д");
    expect(formatDeadline(14)).toBe("14д");
  });

  it("Nд просрочено for negative", () => {
    expect(formatDeadline(-1)).toBe("1д просрочено");
    expect(formatDeadline(-30)).toBe("30д просрочено");
  });
});

describe("daysSince", () => {
  it("returns null for null input", () => {
    expect(daysSince(null, APR29)).toBe(null);
  });

  it("returns 0 for today", () => {
    expect(daysSince("2026-04-29", APR29)).toBe(0);
  });

  it("returns 1 for yesterday", () => {
    expect(daysSince("2026-04-28", APR29)).toBe(1);
  });

  it("returns N for N days ago", () => {
    expect(daysSince("2026-04-01", APR29)).toBe(28);
  });

  it("returns negative for future date", () => {
    expect(daysSince("2026-05-01", APR29)).toBe(-2);
  });

  it("returns null for malformed ISO", () => {
    expect(daysSince("not-a-date", APR29)).toBe(null);
  });
});

describe("cadUrgClass", () => {
  it("empty for null", () => {
    expect(cadUrgClass(null)).toBe("");
  });

  it("bad for over > 0", () => {
    expect(cadUrgClass(1)).toBe("urgency-bad");
    expect(cadUrgClass(30)).toBe("urgency-bad");
  });

  it("warn for over in (-3, 0]", () => {
    expect(cadUrgClass(0)).toBe("urgency-warn");
    expect(cadUrgClass(-1)).toBe("urgency-warn");
    expect(cadUrgClass(-2)).toBe("urgency-warn");
  });

  it("ok for over <= -3", () => {
    expect(cadUrgClass(-3)).toBe("urgency-ok");
    expect(cadUrgClass(-30)).toBe("urgency-ok");
  });
});
