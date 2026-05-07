import type { TaskEntity } from "../schemas";
import { now } from "./clock";
import { daysUntil } from "./urgency";

export interface TaskGroups {
  burning: TaskEntity[];
  urgent: TaskEntity[];
  soon: TaskEntity[];
  notSoon: TaskEntity[];
  someday: TaskEntity[];
  done: TaskEntity[];
}

const PRIO_ORDER: Record<"high" | "medium" | "low", number> = {
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
  today: Date = now(),
): TaskGroups {
  const groups: TaskGroups = {
    burning: [],
    urgent: [],
    soon: [],
    notSoon: [],
    someday: [],
    done: [],
  };
  for (const t of active) {
    const d = daysUntil(t.deadline, today);
    if (d === null) groups.someday.push(t);
    else if (d <= 2) groups.burning.push(t);
    else if (d <= 7) groups.urgent.push(t);
    else if (d <= 30) groups.soon.push(t);
    else groups.notSoon.push(t);
  }
  groups.done = [...done];
  for (const k of Object.keys(groups) as Array<keyof TaskGroups>) {
    groups[k].sort(byPriorityThenDeadline);
  }
  return groups;
}
