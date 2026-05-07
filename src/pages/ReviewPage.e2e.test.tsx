import { test, expect } from "vitest";
import { userEvent } from "vitest/browser";
import { render, type RenderResult } from "vitest-browser-react";
import { Shell } from "../components/layout/Shell";
import { useConfigStore } from "../store/config";
import { useEntityStore } from "../store/entities";
import { usePoolStore } from "../store/pool";
import { useScheduleStore } from "../store/schedule";
import { useUIStore } from "../store/ui";
import { DEFAULT_CONFIG } from "../services/defaults";
import { typicalWeek } from "../test/scenarios/typical-week";
import { installFS } from "../test/virtual-fs";

const WEEK = "2025-w24";

// Each cards component renders a stable <h4> that's unique to the
// period — landmarks let us assert that the grid actually swapped,
// not just the active-class moved. WeekCards has "Пул недели"
// (WeekCards.tsx), MonthCards has "Выполнение по неделям", YearCards
// has "Выполнение по месяцам". Substring match keeps it tolerant of
// trailing punctuation or whitespace.
const PERIOD_LANDMARK = {
  week: "Пул недели",
  month: "Выполнение по неделям",
  year: "Выполнение по месяцам",
} as const;

// Boots Review via typicalWeek. The screen reads currentWeek from
// useScheduleStore — without loadWeek the header collapses to the
// week derived from the empty initial state and stays date-stable
// for the V-2 baseline (see clock.ts → FROZEN_NOW = 2025-06-11).
async function setupReview(): Promise<RenderResult> {
  installFS(typicalWeek());
  useConfigStore.setState({ config: DEFAULT_CONFIG });
  await useScheduleStore.getState().loadWeek(WEEK);
  await usePoolStore.getState().loadWeek(WEEK);
  await useEntityStore.getState().loadEntities(DEFAULT_CONFIG.areas);
  useUIStore.setState({
    bootReady: true,
    currentPage: "review",
    rvPeriod: "week",
  });
  return render(<Shell />);
}

function activeTabText(screen: RenderResult): string | null {
  const el = screen.container.querySelector<HTMLElement>(".rv-tab.active");
  return el?.textContent ?? null;
}

function gridHasLandmark(
  screen: RenderResult,
  landmark: string,
): boolean {
  const grid = screen.container.querySelector(".review-cards-grid");
  return grid?.textContent?.includes(landmark) ?? false;
}

// R-1: clicking each .rv-tab pushes its id into useUIStore.rvPeriod,
// shifts the active class, AND swaps the cards-grid component. The
// landmark assertion catches a regression where the tab-bar cycles
// but the grid stays stuck on the old period.
test("R-1: period tabs switch content", async () => {
  const screen = await setupReview();

  expect(activeTabText(screen)).toBe("Неделя");
  expect(gridHasLandmark(screen, PERIOD_LANDMARK.week)).toBe(true);

  const monthTab = screen.getByRole("button", {
    name: "Месяц",
    exact: true,
  });
  await userEvent.click(monthTab);
  await expect
    .poll(() => useUIStore.getState().rvPeriod)
    .toBe("month");
  await expect.poll(() => activeTabText(screen)).toBe("Месяц");
  await expect
    .poll(() => gridHasLandmark(screen, PERIOD_LANDMARK.month))
    .toBe(true);

  const yearTab = screen.getByRole("button", {
    name: "Год",
    exact: true,
  });
  await userEvent.click(yearTab);
  await expect
    .poll(() => useUIStore.getState().rvPeriod)
    .toBe("year");
  await expect.poll(() => activeTabText(screen)).toBe("Год");
  await expect
    .poll(() => gridHasLandmark(screen, PERIOD_LANDMARK.year))
    .toBe(true);

  const weekTab = screen.getByRole("button", {
    name: "Неделя",
    exact: true,
  });
  await userEvent.click(weekTab);
  await expect
    .poll(() => useUIStore.getState().rvPeriod)
    .toBe("week");
  await expect.poll(() => activeTabText(screen)).toBe("Неделя");
  await expect
    .poll(() => gridHasLandmark(screen, PERIOD_LANDMARK.week))
    .toBe(true);
});

// R-3: V-2 visual baseline. Scoped to [data-screen="review"] so that
// drift in TopNav, StatusBar, or sidebar chrome doesn't break a
// "review summary" baseline — only Review's own layout regressions
// trip this. Threshold matches the spec's 0.005 max-mismatch ratio;
// Vitest 4's default is stricter and would tag harmless font-rendering
// jitter as a regression.
test("R-3: review summary visual baseline", async () => {
  const screen = await setupReview();

  const reviewRoot = screen.container.querySelector<HTMLElement>(
    '[data-screen="review"]',
  );
  if (!reviewRoot) throw new Error("review root not in DOM");

  await expect.element(reviewRoot).toMatchScreenshot("review-summary", {
    comparatorOptions: { allowedMismatchedPixelRatio: 0.005 },
  });
});
