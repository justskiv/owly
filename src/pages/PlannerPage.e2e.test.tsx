import { test, expect } from "vitest";
import { render } from "vitest-browser-react";
import { PlannerPage } from "./PlannerPage";
import { useScheduleStore } from "../store/schedule";
import { useConfigStore } from "../store/config";
import { useUIStore } from "../store/ui";
import {
  edgeBlock,
  edgeConfig,
  edgeWeekState,
} from "../test/fixtures/edge";
import { dragWithPointer } from "../test/e2e/drag";

test("drag existing block to a different day", async () => {
  useConfigStore.setState({ config: edgeConfig });
  useScheduleStore.setState(edgeWeekState);
  useUIStore.setState({ bootReady: true, currentPage: "plan" });

  const screen = render(<PlannerPage />);

  const block = screen.getByLabelText(
    new RegExp(`^${edgeBlock.title}, `, "i"),
  );
  await expect.element(block).toBeVisible();

  const targetDay = screen.container.querySelector<HTMLElement>(
    `.day-body[data-date="2026-05-05"]`,
  );
  if (!targetDay) throw new Error("target day-body not in DOM");

  // useBlockGesture is a pointer-capture handler — userEvent.dragAndDrop
  // happens to work via chromium polyfills but bypasses the threshold
  // logic; raw PointerEvent dispatch via dragWithPointer is the
  // canonical path.
  const r = targetDay.getBoundingClientRect();
  await dragWithPointer(block, {
    x: r.left + r.width / 2,
    y: r.top + r.height / 2,
  });

  // Verify via store rather than DOM — the moveBlock chain finishes
  // asynchronously after the drop and the in-memory blocks array is
  // the canonical signal.
  await expect
    .poll(() => useScheduleStore.getState().blocks[0].date)
    .toBe("2026-05-05");
  expect(useScheduleStore.getState().blocks[0].id).toBe(edgeBlock.id);
});
