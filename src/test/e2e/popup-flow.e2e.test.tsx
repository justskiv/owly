import { test, expect } from "vitest";
import { userEvent } from "vitest/browser";
import { render } from "vitest-browser-react";
import { Shell } from "../../components/layout/Shell";
import { useConfigStore } from "../../store/config";
import { useEntityStore } from "../../store/entities";
import { useScheduleStore } from "../../store/schedule";
import { useUIStore } from "../../store/ui";
import { DEFAULT_CONFIG } from "../../services/defaults";
import { typicalWeek } from "../scenarios/typical-week";
import { getCurrentFS, installFS, ROOT } from "../virtual-fs";
import { flushAllWrites } from "./automation";

const WEEK = "2025-w24";

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

// E-17: a BlockPopup edit that never blurs (outside-click closes the
// popup before React fires onBlur) must still reach disk via the
// unmount-cleanup flush in BlockPopup.tsx:122-175. Regression here
// is silent data loss — the user typed a note, clicked away, and
// the next reload shows the old value.
test("E-17: BlockPopup unmount-flush persists unblurred drafts", async () => {
  installFS(typicalWeek());
  useConfigStore.setState({ config: DEFAULT_CONFIG });
  await useEntityStore.getState().loadEntities(DEFAULT_CONFIG.areas);
  await useScheduleStore.getState().loadWeek(WEEK);
  useUIStore.setState({ bootReady: true, currentPage: "plan" });
  const screen = render(<Shell />);

  const block = useScheduleStore
    .getState()
    .blocks.find((b) => b.title === "Сегодня deep work");
  if (!block) throw new Error("today block missing in fixture");

  // Open BlockPopup directly through the store. Clicking the block
  // would route through useBlockGesture's select-on-pointerup path
  // (no popup), and double-click is what ships in PlannerPage —
  // either is more brittle than just driving the modal we want to
  // exercise. The store API mirrors what double-click ends up doing.
  useUIStore.getState().openBlockPopup(
    block.id,
    { type: "point", x: 100, y: 100 },
    "right",
  );

  // BlockPopup labels its title input "Название" — TaskPopup uses
  // "Название задачи", so /^название$/i disambiguates if both ever
  // mount in parallel.
  const input = screen.getByLabelText(/^название$/i);
  await userEvent.clear(input);
  await userEvent.type(input, "Edited via popup");

  // Close the popup WITHOUT blurring the input — the cleanup effect
  // is the only path that should persist this edit.
  useUIStore.getState().closeBlockPopup();
  await flushAllWrites();

  await expect
    .poll(() =>
      useScheduleStore
        .getState()
        .blocks.find((b) => b.id === block.id)?.title,
    )
    .toBe("Edited via popup");

  const fs = getCurrentFS();
  const week = JSON.parse(fs.read(`${ROOT}/schedule/${WEEK}.json`));
  expect(
    week.blocks.find((b: { id: string }) => b.id === block.id).title,
  ).toBe("Edited via popup");
});
