import { describe, expect, it } from "vitest";
import { gaugeColor, getStrokeOffset, ringCircumference } from "./gauge-math";

describe("ringCircumference", () => {
  it("matches 2πr for default radius 19", () => {
    expect(ringCircumference()).toBeCloseTo(119.38, 1);
  });
});

describe("getStrokeOffset", () => {
  const c = ringCircumference();

  it("returns full circumference at 0%", () => {
    expect(getStrokeOffset(0)).toBeCloseTo(c, 5);
  });

  it("returns half at 50%", () => {
    expect(getStrokeOffset(50)).toBeCloseTo(c / 2, 5);
  });

  it("returns 0 at 100%", () => {
    expect(getStrokeOffset(100)).toBeCloseTo(0, 5);
  });

  it("clamps negatives to 0%", () => {
    expect(getStrokeOffset(-10)).toBeCloseTo(c, 5);
  });

  it("clamps over-100 to 100%", () => {
    expect(getStrokeOffset(150)).toBeCloseTo(0, 5);
  });
});

describe("gaugeColor", () => {
  it("exec: ≥70 success", () => {
    expect(gaugeColor(70, "exec")).toBe("var(--success)");
    expect(gaugeColor(85, "exec")).toBe("var(--success)");
  });
  it("exec: 40..69 warning", () => {
    expect(gaugeColor(40, "exec")).toBe("var(--warning)");
    expect(gaugeColor(69, "exec")).toBe("var(--warning)");
  });
  it("exec: <40 error", () => {
    expect(gaugeColor(0, "exec")).toBe("var(--error)");
    expect(gaugeColor(39, "exec")).toBe("var(--error)");
  });

  it("pool uses the same thresholds as exec", () => {
    expect(gaugeColor(70, "pool")).toBe("var(--success)");
    expect(gaugeColor(40, "pool")).toBe("var(--warning)");
    expect(gaugeColor(39, "pool")).toBe("var(--error)");
  });

  // Cadence has a stricter green threshold (80, not 70).
  it("cadence: ≥80 success, 70 is warning (NOT success)", () => {
    expect(gaugeColor(80, "cadence")).toBe("var(--success)");
    expect(gaugeColor(70, "cadence")).toBe("var(--warning)");
  });
  it("cadence: 50..79 warning", () => {
    expect(gaugeColor(50, "cadence")).toBe("var(--warning)");
    expect(gaugeColor(79, "cadence")).toBe("var(--warning)");
  });
  it("cadence: <50 error", () => {
    expect(gaugeColor(49, "cadence")).toBe("var(--error)");
    expect(gaugeColor(0, "cadence")).toBe("var(--error)");
  });
});
