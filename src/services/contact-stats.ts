import type { ContactFields } from "../schemas";

export interface ContactStats {
  state: "ok" | "overdue" | "unknown";
  overdueDays: number;
  nextInDays: number;
  lastContact: string | null;
  cadence: number | null;
}

function todayISO(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function daysBetween(a: string, b: string): number {
  const da = new Date(`${a}T00:00:00`);
  const db = new Date(`${b}T00:00:00`);
  return Math.round((db.getTime() - da.getTime()) / 86400000);
}

export function computeContactStats(fields: ContactFields): ContactStats {
  const cadence = fields.desired_cadence_days;
  const last = fields.last_contact;
  if (last == null || cadence == null) {
    return {
      state: "unknown",
      overdueDays: 0,
      nextInDays: 0,
      lastContact: last,
      cadence,
    };
  }
  const today = todayISO();
  const sinceLast = daysBetween(last, today);
  const diff = sinceLast - cadence;
  if (diff > 0) {
    return {
      state: "overdue",
      overdueDays: diff,
      nextInDays: 0,
      lastContact: last,
      cadence,
    };
  }
  return {
    state: "ok",
    overdueDays: 0,
    nextInDays: -diff,
    lastContact: last,
    cadence,
  };
}
