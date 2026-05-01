import { getStartOfDay } from "./time-utils";

const MS_PER_DAY = 86_400_000;

export function daysUntil(
  iso: string | null,
  today: Date = new Date(),
): number | null {
  if (!iso) return null;
  const [y, m, d] = iso.split("-").map((p) => parseInt(p, 10));
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) {
    return null;
  }
  const target = new Date(y, m - 1, d).getTime();
  const base = getStartOfDay(today).getTime();
  return Math.round((target - base) / MS_PER_DAY);
}

export function urgClass(d: number | null): string {
  if (d === null) return "";
  if (d <= 3) return "urgency-bad";
  if (d <= 7) return "urgency-warn";
  return "urgency-ok";
}

export function formatDeadline(d: number): string {
  if (d < 0) return `${-d}д просрочено`;
  if (d === 0) return "сегодня";
  return `${d}д`;
}

export function daysSince(
  iso: string | null,
  today: Date = new Date(),
): number | null {
  if (!iso) return null;
  const [y, m, d] = iso.split("-").map((p) => parseInt(p, 10));
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) {
    return null;
  }
  const past = new Date(y, m - 1, d).getTime();
  const base = getStartOfDay(today).getTime();
  return Math.round((base - past) / MS_PER_DAY);
}

// Cadence urgency uses a different formula than `urgClass`. See spec
// §5.7: `over = daysSinceLastAct - cadence`. Past-due (over > 0) is
// the "bad" state; the warning band is the three days before the
// cadence elapses.
export function cadUrgClass(over: number | null): string {
  if (over === null) return "";
  if (over > 0) return "urgency-bad";
  if (over > -3) return "urgency-warn";
  return "urgency-ok";
}
