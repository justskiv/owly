// Math helpers shared by the Review screen's SVG ring gauge. Kept in
// a `.ts` module (not inside the Gauge.tsx component) because vitest
// is configured to pick up `.ts` files only — having the math here
// is the only way to test the threshold colors and the dasharray
// progression without a JSDOM setup.

const RING_R = 19;

export function ringCircumference(r: number = RING_R): number {
  return 2 * Math.PI * r;
}

// strokeDashoffset for an SVG circle at the given completion %.
// At 0% the offset equals the full circumference (ring empty); at
// 100% it equals 0 (ring full). Values outside [0, 100] are clamped
// — the spec uses Math.round on inputs but we still defend against
// future callers that forget.
export function getStrokeOffset(pct: number, r: number = RING_R): number {
  const c = ringCircumference(r);
  const clamped = Math.max(0, Math.min(100, pct));
  return c * (1 - clamped / 100);
}

export type GaugeKind = "exec" | "pool" | "cadence";

// Cadence has a stricter green threshold (≥80) than execution / pool
// (≥70) — see spec §9.4 acceptance criteria. Hard-coding it as a
// branch instead of two separate functions so callers can stay
// agnostic of which gauge they're rendering.
export function gaugeColor(value: number, kind: GaugeKind): string {
  const [green, yellow] = kind === "cadence" ? [80, 50] : [70, 40];
  if (value >= green) return "var(--success)";
  if (value >= yellow) return "var(--warning)";
  return "var(--error)";
}
