import { addDays } from "date-fns";
import { now } from "../../services/clock";
import { formatDate } from "../../services/time-utils";

export const onToday = () => ({ date: formatDate(now()) });

export const onTomorrow = () => ({
  date: formatDate(addDays(now(), 1)),
});

export const onYesterday = () => ({
  date: formatDate(addDays(now(), -1)),
});

export const onMonday = () => {
  const d = now();
  const day = d.getDay(); // Sun=0..Sat=6
  const diff = day === 0 ? -6 : 1 - day; // ISO Mon offset
  return { date: formatDate(addDays(d, diff)) };
};

export const inDeepWorkSlot = () => ({
  start: "09:00" as const,
  duration: 120,
  category: "work",
});

export const done = () => ({ status: "done" as const });
export const planned = () => ({ status: "planned" as const });

export const withDeadlineIn = (days: number) => ({
  deadline: formatDate(addDays(now(), days)),
});
