import { useEffect, useMemo, useState } from "react";
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

interface HistoricalState {
  ids: string[];
  bundles: (WeekBundle | null)[];
}

const EMPTY_HISTORICAL: HistoricalState = { ids: [], bundles: [] };

// Module-level monotonic counter mirrors the loadToken pattern in
// schedule.ts:66. Bumped at the start of EVERY effect run so a slow
// year load can't land after the user already switched back to week
// mode and stomp the live data with stale disk reads.
let loadToken = 0;

// We split the bundle list into two parts:
//   - current week (offset 0)        → live from store, always fresh
//   - historical weeks (offsets 1..N) → read through loadWeekBundle
//
// That way a planner edit on the current week updates Card 1
// immediately without re-fetching 52 files, and a tab switch can show
// Card 1 with live data while historical is still loading.
export function useReviewData(
  period: ReviewPeriod,
  currentWeek: string,
): ReviewData {
  const blocks = useScheduleStore((s) => s.blocks);
  const items = usePoolStore((s) => s.items);
  const [historical, setHistorical] =
    useState<HistoricalState>(EMPTY_HISTORICAL);
  const [historicalLoading, setHistoricalLoading] = useState(false);

  useEffect(() => {
    const myToken = ++loadToken;

    if (period === "week") {
      setHistorical(EMPTY_HISTORICAL);
      setHistoricalLoading(false);
      return;
    }

    // Skip offset 0 — current week is composed live from the stores
    // below. Offsets 1..N-1 are the historical window.
    const count = period === "month" ? 3 : 51;
    const ids = Array.from({ length: count }, (_, i) =>
      addWeeks(currentWeek, -(i + 1)),
    );
    setHistoricalLoading(true);
    Promise.all(ids.map(loadWeekBundle)).then((bundles) => {
      if (myToken !== loadToken) return;
      setHistorical({ ids, bundles });
      setHistoricalLoading(false);
    });
  }, [period, currentWeek]);

  return useMemo(() => {
    const currentBundle: WeekBundle = {
      blocks,
      pool: recalcPool(items, blocks),
    };
    const weeks: ReviewWeekEntry[] = [
      { id: currentWeek, bundle: currentBundle },
      ...historical.ids.map((id, i) => ({
        id,
        bundle: historical.bundles[i] ?? null,
      })),
    ];
    return {
      status: historicalLoading ? "loading" : "ready",
      weeks,
    };
  }, [blocks, items, currentWeek, historical, historicalLoading]);
}
