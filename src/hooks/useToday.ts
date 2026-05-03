import { useEffect, useState } from "react";
import { getStartOfDay } from "../services/time-utils";

const MS_PER_DAY = 86_400_000;

// Returns a Date that refreshes on local midnight and on tab focus,
// so cadence/window math doesn't go stale in a long-running Tauri
// session. Multiple components mounting this hook each get their
// own listener; cheap, no shared state needed.
export function useToday(): Date {
  const [today, setToday] = useState(() => new Date());

  useEffect(() => {
    let timer: number | undefined;

    const scheduleMidnight = () => {
      const now = new Date();
      const ms = getStartOfDay(now).getTime() + MS_PER_DAY - now.getTime();
      // +500ms buffer guards against a wakeup that fires a few ms
      // early and re-schedules to the same day.
      timer = window.setTimeout(() => {
        setToday(new Date());
        scheduleMidnight();
      }, ms + 500);
    };
    scheduleMidnight();

    const onVisible = () => {
      if (!document.hidden) setToday(new Date());
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      if (timer !== undefined) window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  return today;
}
