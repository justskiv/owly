import { test, expect } from "vitest";
import { userEvent } from "vitest/browser";
import { render } from "vitest-browser-react";
import { Shell } from "../../components/layout/Shell";
import { useConfigStore } from "../../store/config";
import { useEntityStore } from "../../store/entities";
import { useUIStore } from "../../store/ui";
import { DEFAULT_CONFIG } from "../../services/defaults";
import { typicalWeek } from "../scenarios/typical-week";
import { installFS } from "../virtual-fs";
import { flushAllWrites } from "./automation";

// F-8: editing a task title through EntityPopup persists to the store
// AND the new title shows up on a different screen — Plan's pool side
// panel with sideTab="tasks" renders the entity list, so we land
// there after the edit and assert the new title is visible. That
// proves cross-screen subscription, not just popup-local draft + same-
// screen remount.
//
// gotoScreen is bypassed via direct setPage because of the data-tab
// vs ScreenName drift (see post-review-backlog) — a navigation click
// would fall back to "proj"/"ctx" mismatches when other tests reuse
// the helper for non-Plan/Tasks screens.
test("F-8: entity popup edit propagates across screens", async () => {
  installFS(typicalWeek());
  useConfigStore.setState({ config: DEFAULT_CONFIG });
  await useEntityStore.getState().loadEntities(DEFAULT_CONFIG.areas);
  useUIStore.setState({ bootReady: true, currentPage: "tasks" });
  const screen = render(<Shell />);

  // Open popup by clicking the task row. .tr-title is rendered inside
  // .task-row whose onClick triggers openEntityPopup.
  await userEvent.click(screen.getByText("Test report"));

  // Behavioural locator — TaskPopup labels the title input with
  // aria-label="Название задачи" (TaskPopup.tsx). A class rename or
  // wrapper refactor won't break this assertion.
  const titleInput = screen.getByLabelText(/название задачи/i);
  await userEvent.clear(titleInput);
  await userEvent.type(titleInput, "Test report (edited)");
  // Blur via Tab — TaskPopup persists in onBlur.
  await userEvent.keyboard("{Tab}");
  await flushAllWrites();

  // Close popup via Escape (popup listens to ESC at the host level).
  await userEvent.keyboard("{Escape}");

  await expect
    .poll(() =>
      useEntityStore
        .getState()
        .entities.some((e) => e.title === "Test report (edited)"),
    )
    .toBe(true);

  // Cross-screen: jump to Plan and surface the entity list via the
  // tasks side-tab. PoolTabTasks renders unscheduled tasks from the
  // entity store, so the renamed task must appear there if the
  // subscription is wired correctly.
  useUIStore.setState({ currentPage: "plan", sideTab: "tasks" });

  await expect
    .element(screen.getByText("Test report (edited)"))
    .toBeVisible();
});
