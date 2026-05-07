import { test, expect } from "vitest";
import { userEvent } from "vitest/browser";
import { render, type RenderResult } from "vitest-browser-react";
import { Shell } from "../components/layout/Shell";
import { PlannerPage } from "./PlannerPage";
import { useScheduleStore } from "../store/schedule";
import { useConfigStore } from "../store/config";
import { useEntityStore } from "../store/entities";
import { usePoolStore } from "../store/pool";
import { useUIStore } from "../store/ui";
import { DEFAULT_CONFIG } from "../services/defaults";
import { ROW_H } from "../services/time-utils";
import {
  edgeBlock,
  edgeConfig,
  edgeWeekState,
} from "../test/fixtures/edge";
import { typicalWeek } from "../test/scenarios/typical-week";
import { installFS, getCurrentFS } from "../test/virtual-fs";
import { buildPoolItem } from "../test/builders/pool";
import { dragWithPointer } from "../test/e2e/drag";
import { flushAllWrites, seedEmptyWeeks } from "../test/e2e/automation";

const WEEK = "2025-w24";
const TODAY = "2025-06-11";
const TOMORROW = "2025-06-12";
const SCHEDULE_PATH = `/tuzov-test/data/schedule/${WEEK}.json`;

// Boots from typicalWeek scenario via VirtualFS so each test goes
// through the real loadWeek/loadEntities path. Returns the rendered
// scope. Pass `withShell: true` for tests that interact with the
// TopNav (week navigation) — Shell wraps PlannerPage in nav chrome.
async function setupPlanner(
  opts: { withShell?: boolean } = {},
): Promise<RenderResult> {
  installFS(typicalWeek());
  useConfigStore.setState({ config: DEFAULT_CONFIG });
  await useScheduleStore.getState().loadWeek(WEEK);
  await usePoolStore.getState().loadWeek(WEEK);
  await useEntityStore.getState().loadEntities(DEFAULT_CONFIG.areas);
  useUIStore.setState({ bootReady: true, currentPage: "plan" });
  return opts.withShell ? render(<Shell />) : render(<PlannerPage />);
}

// P-1: today is highlighted in the week grid.
test("P-1: today is highlighted", async () => {
  const screen = await setupPlanner();
  const todayBody = screen.container.querySelector<HTMLElement>(
    `.day-body[data-date="${TODAY}"]`,
  );
  expect(todayBody).not.toBeNull();
  const todayHeads = screen.container.querySelectorAll<HTMLElement>(
    ".day-head.today",
  );
  expect(todayHeads.length).toBe(1);
});

// P-3: legacy E1 migration — uses edge fixtures, kept as-is.
test("P-3: drag existing block to a different day", async () => {
  installFS(typicalWeek());
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

  const r = targetDay.getBoundingClientRect();
  await dragWithPointer(block, {
    x: r.left + r.width / 2,
    y: r.top + r.height / 2,
  });

  await expect
    .poll(() => useScheduleStore.getState().blocks[0].date)
    .toBe("2026-05-05");
  expect(useScheduleStore.getState().blocks[0].id).toBe(edgeBlock.id);

  // Disk parity — moveBlock writes through enqueueWeekWrite; without
  // flush an asymptotically-failing queue would silently leave the
  // store ahead of disk.
  await flushAllWrites();
  const fs = getCurrentFS();
  const week = JSON.parse(
    fs.read(`/tuzov-test/data/schedule/${edgeWeekState.currentWeek}.json`),
  );
  expect(
    week.blocks.find((b: { id: string }) => b.id === edgeBlock.id).date,
  ).toBe("2026-05-05");
});

// P-4: drag block down 2 rows (= +1 hour) — start "09:00" → "10:00".
test("P-4: drag block to a later time updates start", async () => {
  const screen = await setupPlanner();
  const block = screen.getByLabelText(/^Сегодня deep work, /i);
  const src = (block.element() as HTMLElement).getBoundingClientRect();
  // dragWithPointer starts from source center; +2*ROW_H Y delta moves
  // the block down by 1 hour (each row = 30 min in time-utils).
  await dragWithPointer(block, {
    x: src.left + src.width / 2,
    y: src.top + src.height / 2 + 2 * ROW_H,
  });

  await expect
    .poll(() =>
      useScheduleStore
        .getState()
        .blocks.find((b) => b.title === "Сегодня deep work")?.start,
    )
    .toBe("10:00");

  await flushAllWrites();
  const fs = getCurrentFS();
  const week = JSON.parse(fs.read(SCHEDULE_PATH));
  expect(
    week.blocks.find(
      (b: { title: string }) => b.title === "Сегодня deep work",
    ).start,
  ).toBe("10:00");
});

// P-5: resize from bottom — duration 120 → 150 (dy=+ROW_H = +30 min).
test("P-5: resize block from bottom edge updates duration", async () => {
  const screen = await setupPlanner();
  const block = screen.container.querySelector<HTMLElement>(
    `[aria-label^="Сегодня deep work,"]`,
  );
  if (!block) throw new Error("deep-work block not in DOM");
  const handle = block.querySelector<HTMLElement>(".resize-handle");
  if (!handle) throw new Error("resize-handle missing");

  const r = handle.getBoundingClientRect();
  const x = r.left + r.width / 2;
  const y0 = r.top + r.height / 2;
  handle.dispatchEvent(
    new PointerEvent("pointerdown", {
      bubbles: true,
      clientX: x,
      clientY: y0,
      pointerId: 1,
      button: 0,
      isPrimary: true,
    }),
  );
  // 3 intermediate moves clear DRAG_THRESHOLD_PX (5) on first step
  // (ROW_H/3 ≈ 13.3px) and ramp into the final +ROW_H delta.
  for (let i = 1; i <= 3; i++) {
    document.dispatchEvent(
      new PointerEvent("pointermove", {
        bubbles: true,
        clientX: x,
        clientY: y0 + (ROW_H * i) / 3,
        pointerId: 1,
      }),
    );
  }
  document.dispatchEvent(
    new PointerEvent("pointerup", {
      bubbles: true,
      clientX: x,
      clientY: y0 + ROW_H,
      pointerId: 1,
    }),
  );

  await expect
    .poll(() =>
      useScheduleStore
        .getState()
        .blocks.find((b) => b.title === "Сегодня deep work")?.duration,
    )
    .toBe(150);

  await flushAllWrites();
  const fs = getCurrentFS();
  const week = JSON.parse(fs.read(SCHEDULE_PATH));
  expect(
    week.blocks.find(
      (b: { title: string }) => b.title === "Сегодня deep work",
    ).duration,
  ).toBe(150);
});

// P-7: Delete key on a selected block removes it.
test("P-7: Delete key removes selected block", async () => {
  // setupPlanner() renders <PlannerPage /> — required so the page's
  // keydown effect (lines 132-185 in PlannerPage.tsx) is mounted and
  // can intercept the Delete key.
  await setupPlanner();
  const before = useScheduleStore.getState().blocks.length;
  const target = useScheduleStore
    .getState()
    .blocks.find((b) => b.title === "Сегодня deep work");
  if (!target) throw new Error("deep-work block missing in fixture");

  // Select via store, not via click — Plan's Delete handler fires
  // off `selectedBlockId`, not focus, so this is the contract path.
  // (Click on a block enters useBlockGesture which only selects on
  // small-movement releases; that wiring deserves its own test.)
  useUIStore.getState().setSelectedBlock(target.id);

  await userEvent.keyboard("{Delete}");

  await expect
    .poll(() => useScheduleStore.getState().blocks.length)
    .toBe(before - 1);
  expect(
    useScheduleStore
      .getState()
      .blocks.some((b) => b.id === target.id),
  ).toBe(false);

  await flushAllWrites();
  const fs = getCurrentFS();
  const week = JSON.parse(fs.read(SCHEDULE_PATH));
  expect(
    week.blocks.some(
      (b: { id: string }) => b.id === target.id,
    ),
  ).toBe(false);
});

// P-8: prev-week arrow navigates back one week.
test("P-8: prev arrow loads previous week", async () => {
  const screen = await setupPlanner({ withShell: true });
  seedEmptyWeeks(["2025-w23"]);
  const prev = screen.container.querySelector<HTMLElement>(
    `.wk-arrow[aria-label="Предыдущая неделя"]`,
  );
  if (!prev) throw new Error("prev arrow not in DOM");
  await userEvent.click(prev);
  await expect
    .poll(() => useScheduleStore.getState().currentWeek)
    .toBe("2025-w23");
});

// P-9: "Сегодня" button after navigating away returns to current.
test("P-9: today button returns to current week", async () => {
  const screen = await setupPlanner({ withShell: true });
  seedEmptyWeeks(["2025-w23", "2025-w22"]);
  const prev = screen.container.querySelector<HTMLElement>(
    `.wk-arrow[aria-label="Предыдущая неделя"]`,
  );
  if (!prev) throw new Error("prev arrow not in DOM");
  await userEvent.click(prev);
  await userEvent.click(prev);
  await expect
    .poll(() => useScheduleStore.getState().currentWeek)
    .toBe("2025-w22");

  const today = screen.container.querySelector<HTMLElement>(".wk-today");
  if (!today) throw new Error("today button not in DOM");
  await userEvent.click(today);
  await expect
    .poll(() => useScheduleStore.getState().currentWeek)
    .toBe(WEEK);
});

// P-10: drag a pool item onto the grid creates a linked block.
test("P-10: drag pool item creates a linked block", async () => {
  installFS(typicalWeek());
  useConfigStore.setState({ config: DEFAULT_CONFIG });
  await useScheduleStore.getState().loadWeek(WEEK);
  await usePoolStore.getState().loadWeek(WEEK);
  await useEntityStore.getState().loadEntities(DEFAULT_CONFIG.areas);
  // Seed pool BEFORE render so the first paint includes the item —
  // typicalWeek's pool/2025-w24.json is empty, and seeding after
  // render races the React commit on `usePoolStore.setState`.
  usePoolStore.setState({
    items: [buildPoolItem({ title: "Pool task", category: "work" })],
  });
  useUIStore.setState({ bootReady: true, currentPage: "plan" });
  const screen = render(<PlannerPage />);

  const poolEl = screen.container.querySelector<HTMLElement>(
    ".s-item.draggable",
  );
  if (!poolEl) throw new Error("pool .s-item.draggable not in DOM");

  const target = screen.container.querySelector<HTMLElement>(
    `.day-body[data-date="${TOMORROW}"]`,
  );
  if (!target) throw new Error("target day-body not in DOM");
  const r = target.getBoundingClientRect();
  // dragWithPointer accepts anything with `.element()`; the inline
  // wrapper is enough since we already resolved the DOM node above.
  await dragWithPointer({ element: () => poolEl }, {
    x: r.left + r.width / 2,
    y: r.top + r.height / 2,
  });

  await expect
    .poll(() =>
      useScheduleStore
        .getState()
        .blocks.some(
          (b) => b.pool_item_id !== null && b.date === TOMORROW,
        ),
    )
    .toBe(true);
});
