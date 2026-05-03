import { useEffect, useState } from "react";
import { recalcPool } from "../services/recalc-pool";
import {
  loadWeekBundle,
  type WeekBundle,
} from "../services/review-aggregations";
import { addWeeks } from "../services/time-utils";
import { usePoolStore } from "../store/pool";
import { useScheduleStore } from "../store/schedule";
import type { ReviewPeriod } from "../store/ui";

export interface ReviewWeekEntry {
  id: string;
  bundle: WeekBundle | null;
}

export interface ReviewData {
  status: "loading" | "ready";
  weeks: ReviewWeekEntry[];
}

// Module-level monotonic counter mirrors the loadToken pattern in
// schedule.ts. Without it, switching `week → year → week` while the
// disk is slow lets the year resolver land after the week one and
// stomp the freshly-set state.
let loadToken = 0;

export function useReviewData(
  period: ReviewPeriod,
  currentWeek: string,
): ReviewData {
  const blocks = useScheduleStore((s) => s.blocks);
  const items = usePoolStore((s) => s.items);
  const [data, setData] = useState<ReviewData>({
    status: "ready",
    weeks: [],
  });

  useEffect(() => {
    if (period === "week") {
      // Current week reads straight from the live stores — no I/O,
      // no race window. recalcPool is cheap and stays in lockstep
      // with planner edits because both stores update synchronously.
      setData({
        status: "ready",
        weeks: [
          {
            id: currentWeek,
            bundle: { blocks, pool: recalcPool(items, blocks) },
          },
        ],
      });
      return;
    }

    const myToken = ++loadToken;
    setData((prev) => ({ ...prev, status: "loading" }));
    const count = period === "month" ? 4 : 52;
    const ids = Array.from({ length: count }, (_, i) =>
      addWeeks(currentWeek, -i),
    );
    Promise.all(ids.map(loadWeekBundle)).then((bundles) => {
      if (myToken !== loadToken) return;
      setData({
        status: "ready",
        weeks: ids.map((id, i) => ({ id, bundle: bundles[i] })),
      });
    });
  }, [period, currentWeek, blocks, items]);

  return data;
}
