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

// Returns the active period button's text — `.rv-tab.active` is the
// only DOM signal that the click landed (period switch also swaps
// the cards grid, but the cards themselves don't have a stable
// "this is week-vs-month" attribute).
function activeTabText(screen: RenderResult): string | null {
  const el = screen.container.querySelector<HTMLElement>(".rv-tab.active");
  return el?.textContent ?? null;
}

// R-1: clicking each .rv-tab pushes its id into useUIStore.rvPeriod
// and shifts the active class. The cards grid swaps from WeekCards
// to MonthCards/YearCards, but those components don't expose
// reliable text landmarks — the active class is the contract.
test("R-1: period tabs switch content", async () => {
  const screen = await setupReview();

  expect(activeTabText(screen)).toBe("Неделя");

  const monthTab = screen.getByRole("button", { name: "Месяц" });
  await userEvent.click(monthTab);
  await expect
    .poll(() => useUIStore.getState().rvPeriod)
    .toBe("month");
  await expect.poll(() => activeTabText(screen)).toBe("Месяц");

  const yearTab = screen.getByRole("button", { name: "Год" });
  await userEvent.click(yearTab);
  await expect
    .poll(() => useUIStore.getState().rvPeriod)
    .toBe("year");
  await expect.poll(() => activeTabText(screen)).toBe("Год");

  const weekTab = screen.getByRole("button", { name: "Неделя", exact: true });
  await userEvent.click(weekTab);
  await expect
    .poll(() => useUIStore.getState().rvPeriod)
    .toBe("week");
  await expect.poll(() => activeTabText(screen)).toBe("Неделя");
});

// R-3: V-2 visual baseline. The first run creates the baseline png
// under __screenshots__/ReviewPage.e2e.test.tsx/ — review-summary
// at FROZEN_NOW=2025-06-11 (W24, 9–15 июн). Subsequent runs diff
// against it; the threshold matches the spec's 0.005 max-mismatch
// ratio — Vitest 4's default is stricter and would tag harmless
// font-rendering jitter as a regression.
test("R-3: review summary visual baseline", async () => {
  const screen = await setupReview();

  await expect.element(screen.container).toMatchScreenshot(
    "review-summary",
    {
      comparatorOptions: { allowedMismatchedPixelRatio: 0.005 },
    },
  );
});
