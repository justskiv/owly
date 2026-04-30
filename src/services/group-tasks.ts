import type { TaskEntity } from "../schemas";
import { daysUntil } from "./urgency";

export interface TaskGroups {
  burning: TaskEntity[];
  urgent: TaskEntity[];
  soon: TaskEntity[];
  someday: TaskEntity[];
  done: TaskEntity[];
}

const PRIO_ORDER: Record<string, number> = {
  high: 0,
  medium: 1,
  low: 2,
};

export function byPriorityThenDeadline(a: TaskEntity, b: TaskEntity): number {
  const pa = a.priority ? PRIO_ORDER[a.priority] : 3;
  const pb = b.priority ? PRIO_ORDER[b.priority] : 3;
  if (pa !== pb) return pa - pb;
  if (a.deadline === null) return 1;
  if (b.deadline === null) return -1;
  return a.deadline.localeCompare(b.deadline);
}

export function groupTasks(
  active: TaskEntity[],
  done: TaskEntity[],
  today: Date = new Date(),
): TaskGroups {
  const groups: TaskGroups = {
    burning: [],
    urgent: [],
    soon: [],
    someday: [],
    done: [],
  };
  for (const t of active) {
    const d = daysUntil(t.deadline, today);
    if (d === null || d > 30) groups.someday.push(t);
    else if (d <= 2) groups.burning.push(t);
    else if (d <= 7) groups.urgent.push(t);
    else groups.soon.push(t);
  }
  groups.done = [...done];
  for (const k of Object.keys(groups) as Array<keyof TaskGroups>) {
    groups[k].sort(byPriorityThenDeadline);
  }
  return groups;
}
