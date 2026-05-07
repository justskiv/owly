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

// F-8: editing a task title through EntityPopup persists to the store,
// the same row reflects the new title, and a screen switch + return
// still shows the edited title — proving the subscription is wired,
// not just the popup-local draft. The title <input> is a controlled
// `<input class="ep-title" aria-label="Название задачи">` in TaskPopup
// (entities/popup/TaskPopup.tsx); onBlur calls updateEntity(...). Tab
// blurs the input which triggers the persist.
//
// Cross-screen via direct setPage (gotoScreen unsafe for the
// "context"/"projects" mismatch — see automation.ts data-tab vs
// ScreenName drift). Switching to "plan" then back to "tasks" forces
// TasksPage to re-mount and re-subscribe.
test("F-8: entity popup edit propagates across screens", async () => {
  installFS(typicalWeek());
  useConfigStore.setState({ config: DEFAULT_CONFIG });
  await useEntityStore.getState().loadEntities(DEFAULT_CONFIG.areas);
  useUIStore.setState({ bootReady: true, currentPage: "tasks" });
  const screen = render(<Shell />);

  // Open popup by clicking the task row. .tr-title is rendered inside
  // .task-row whose onClick triggers openEntityPopup.
  await userEvent.click(screen.getByText("Test report"));

  const titleInput = screen.container.querySelector<HTMLInputElement>(
    ".entity-popup input.ep-title",
  );
  if (!titleInput) throw new Error("ep-title input not in DOM");

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

  // Force TasksPage re-mount via screen switch.
  useUIStore.setState({ currentPage: "plan" });
  useUIStore.setState({ currentPage: "tasks" });

  await expect
    .element(screen.getByText("Test report (edited)"))
    .toBeVisible();
});
