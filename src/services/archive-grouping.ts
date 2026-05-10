import type { TaskEntity } from "../schemas";
import { MONTH_NAMES_RU } from "./calendar-i18n";

export interface ArchiveGroup {
  // "YYYY-MM" for known dates, "unknown" for the null-completed_at
  // bucket. Stable across renders so React keys don't churn.
  key: string;
  label: string;
  items: TaskEntity[];
}

const UNKNOWN_KEY = "unknown";

// Groups archived (done) tasks by month of `completed_at`. The input
// is expected to already be sorted in the caller's chosen order
// (typically completed_at desc), and this function preserves that
// order both within and across groups — buckets appear in the order
// their first item is encountered, then the "unknown" bucket trails
// at the end.
export function groupArchiveByMonth(
  tasks: TaskEntity[],
  now: Date,
): ArchiveGroup[] {
  const buckets = new Map<string, ArchiveGroup>();
  let unknown: ArchiveGroup | null = null;

  for (const task of tasks) {
    if (task.completed_at === null) {
      if (!unknown) {
        unknown = {
          key: UNKNOWN_KEY,
          label: "Дата завершения неизвестна",
          items: [],
        };
      }
      unknown.items.push(task);
      continue;
    }
    const d = new Date(task.completed_at);
    const y = d.getFullYear();
    const m = d.getMonth();
    const key = `${y}-${String(m + 1).padStart(2, "0")}`;
    let bucket = buckets.get(key);
    if (!bucket) {
      bucket = { key, label: formatGroupLabel(y, m, now), items: [] };
      buckets.set(key, bucket);
    }
    bucket.items.push(task);
  }

  const out = Array.from(buckets.values());
  if (unknown) out.push(unknown);
  return out;
}

// "Май 2026 · этот месяц" / "Апрель 2026 · прошлый месяц" /
// "Март 2026" (same year) / "Декабрь 2025" (other years).
export function formatGroupLabel(
  year: number,
  monthIndex: number,
  now: Date,
): string {
  const monthName = MONTH_NAMES_RU[monthIndex];
  const base = `${monthName} ${year}`;
  const nowY = now.getFullYear();
  const nowM = now.getMonth();
  if (year === nowY && monthIndex === nowM) {
    return `${base} · этот месяц`;
  }
  // Previous month: handle January wrap (Jan 2026 → Dec 2025).
  const prevY = nowM === 0 ? nowY - 1 : nowY;
  const prevM = nowM === 0 ? 11 : nowM - 1;
  if (year === prevY && monthIndex === prevM) {
    return `${base} · прошлый месяц`;
  }
  return base;
}
