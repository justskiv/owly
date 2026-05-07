import { useEffect, useState } from "react";
import { now } from "../services/clock";
import { getStartOfDay } from "../services/time-utils";

const MS_PER_DAY = 86_400_000;

// Returns a Date that refreshes on local midnight and on tab focus,
// so cadence/window math doesn't go stale in a long-running Tauri
// session. Multiple components mounting this hook each get their
// own listener; cheap, no shared state needed.
export function useToday(): Date {
  const [today, setToday] = useState(() => now());

  useEffect(() => {
    let timer: number | undefined;

    const scheduleMidnight = () => {
      const wall = now();
      const ms = getStartOfDay(wall).getTime() + MS_PER_DAY - wall.getTime();
      // +500ms buffer guards against a wakeup that fires a few ms
      // early and re-schedules to the same day.
      timer = window.setTimeout(() => {
        setToday(now());
        scheduleMidnight();
      }, ms + 500);
    };
    scheduleMidnight();

    const onVisible = () => {
      if (!document.hidden) setToday(now());
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      if (timer !== undefined) window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  return today;
}
