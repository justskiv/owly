import { test, expect } from "vitest";
import { userEvent } from "vitest/browser";
import { render, cleanup } from "vitest-browser-react";
import App from "../../App";
import { Shell } from "../../components/layout/Shell";
import { useConfigStore } from "../../store/config";
import { useEntityStore } from "../../store/entities";
import { useScheduleStore } from "../../store/schedule";
import { usePoolStore } from "../../store/pool";
import { useUIStore } from "../../store/ui";
import { DEFAULT_CONFIG } from "../../services/defaults";
import { resetAllStores } from "../stores";
import { resetServiceSingletons } from "../reset-singletons";
import { typicalWeek } from "../scenarios/typical-week";
import { empty } from "../scenarios/empty";
import { installFS, getCurrentFS, ROOT } from "../virtual-fs";
import { buildPoolItem } from "../builders";
import { dragWithPointer } from "./drag";
import {
  quickAdd,
  gotoScreen,
  flushAllWrites,
  seedEmptyWeeks,
} from "./automation";

const WEEK = "2025-w24";

// J-1: today's deep-work block is rendered, then a pool item is
// dragged onto today's day-body and a new block appears. typicalWeek
// has an empty pool, so we seed one item in the week's pool file
// before loadWeek pulls it into the store.
test("J-1: today block visible, drag pool item to today", async () => {
  installFS(typicalWeek());
  useConfigStore.setState({ config: DEFAULT_CONFIG });
  await useEntityStore.getState().loadEntities(DEFAULT_CONFIG.areas);
  await useScheduleStore.getState().loadWeek(WEEK);

  // typicalWeek wrote pool/2025-w24.json with items: [] — patch it,
  // then re-load the pool store from the patched file. Use the
  // builder so PoolItemSchema.parse fills the required fields
  // (hours, splittable, source_kind, ...).
  const fs = getCurrentFS();
  const poolFile = JSON.parse(fs.read(`${ROOT}/pool/${WEEK}.json`));
  poolFile.items = [
    buildPoolItem({
      id: "pool-j1",
      title: "Pool task for J-1",
      category: "work",
      placed: false,
    }),
  ];
  fs.write(`${ROOT}/pool/${WEEK}.json`, JSON.stringify(poolFile, null, 2));
  await usePoolStore.getState().loadWeek(WEEK);

  useUIStore.setState({ bootReady: true, currentPage: "plan" });
  const screen = render(<Shell />);

  await expect
    .element(screen.getByText("Сегодня deep work"))
    .toBeVisible();

  // Pool item lives in PoolPanel's "pool" tab (ui.sideTab default is
  // "pool"). SItem renders <div class="s-item draggable"> whose body
  // contains the title in .s-title. Resolve by title text match.
  const poolItems = Array.from(
    screen.container.querySelectorAll<HTMLElement>(".s-item"),
  );
  const sourceEl = poolItems.find((el) =>
    el.textContent?.includes("Pool task for J-1"),
  );
  if (!sourceEl) throw new Error("pool item not in DOM");

  const todayCell = screen.container.querySelector<HTMLElement>(
    '.day-body[data-date="2025-06-11"]',
  );
  if (!todayCell) throw new Error("today day-body not in DOM");
  const r = todayCell.getBoundingClientRect();

  await dragWithPointer(
    { element: () => sourceEl },
    { x: r.left + r.width / 2, y: r.top + 60 },
  );
  await flushAllWrites();

  // Verify the dropped block landed on today (2025-06-11), kept the
  // pool item's title, and links back to it via pool_item_id —
  // catches a regression where the drop creates a block on the wrong
  // day or loses the pool linkage. See useBlockGesture.ts:323-333.
  await expect
    .poll(() =>
      useScheduleStore
        .getState()
        .blocks.find((b) => b.pool_item_id === "pool-j1"),
    )
    .toMatchObject({
      title: "Pool task for J-1",
      date: "2025-06-11",
      pool_item_id: "pool-j1",
    });
});

// J-2: marking a block done updates the schedule store, and switching
// to Review shows the gauge subtitle reflecting the new done count.
// The mark-done UX is BlockContextMenu (right-click → Выполнено) and
// is not covered as a journey step — the assertion here is that
// Review subscribes to the schedule store, not the UX of marking done.
// The "Выполнение блоков" gauge subtitle has the form "X/Y блоков ...";
// asserting that pattern catches a regression where Review reads a
// stale snapshot.
test("J-2: done block updates Review", async () => {
  installFS(typicalWeek());
  useConfigStore.setState({ config: DEFAULT_CONFIG });
  await useEntityStore.getState().loadEntities(DEFAULT_CONFIG.areas);
  await useScheduleStore.getState().loadWeek(WEEK);
  useUIStore.setState({ bootReady: true, currentPage: "plan" });
  const screen = render(<Shell />);

  const todayBlock = useScheduleStore
    .getState()
    .blocks.find((b) => b.title === "Сегодня deep work");
  if (!todayBlock) throw new Error("today block not in store");

  await useScheduleStore
    .getState()
    .updateBlock(todayBlock.id, { status: "done" });
  await flushAllWrites();

  await gotoScreen(screen, "review");

  // Compute the expected gauge subtitle from the post-mutation store
  // instead of pinning "2/3" — typicalWeek's seed can grow without
  // breaking this oracle. The "Выполнение блоков" gauge in WeekCards
  // renders subtitle as "<done>/<total> блоков · ...".
  const blocks = useScheduleStore.getState().blocks;
  const total = blocks.length;
  const done = blocks.filter((b) => b.status === "done").length;
  const re = new RegExp(`${done}/${total}\\s+блоков`);
  await expect.element(screen.getByText(re)).toBeVisible();
});

// J-3: full persistence round-trip. Quick Add a task, flush queues,
// reload the app (cleanup → reset stores → reset singletons →
// re-render), then verify Tasks shows it. cleanup() must run before
// resetAllStores so the unmounting <App /> doesn't write empty state
// back onto the FS during teardown. The most valuable test for a
// JSON-file-backed product — covers boot, load, write-queue flush,
// re-boot, and re-read in one shot.
test("J-3: persistence round-trip via reload", async () => {
  installFS(empty());
  let screen = render(<App />);
  await expect
    .poll(() => useUIStore.getState().bootReady, { timeout: 5000 })
    .toBe(true);

  await quickAdd(screen, "Persistent task");
  await flushAllWrites();

  const fs = getCurrentFS();
  const file = JSON.parse(fs.read(`${ROOT}/entities.json`));
  expect(
    file.entities.some(
      (e: { title: string }) => e.title === "Persistent task",
    ),
  ).toBe(true);

  cleanup();
  resetAllStores();
  await resetServiceSingletons();

  screen = render(<App />);
  await expect
    .poll(() => useUIStore.getState().bootReady, { timeout: 5000 })
    .toBe(true);

  await gotoScreen(screen, "tasks");
  await expect.element(screen.getByText("Persistent task")).toBeVisible();
});

// J-4: prev/next/today navigation preserves data. seedEmptyWeeks
// pre-creates 2025-w23 so goToPrev doesn't trip WeekNotFoundDialog.
// Snapshot titles before nav and re-check after — `length === 3` would
// pass even if blocks were dropped and recreated empty.
test("J-4: prev → next → today preserves data", async () => {
  installFS(typicalWeek());
  seedEmptyWeeks(["2025-w23"]);
  useConfigStore.setState({ config: DEFAULT_CONFIG });
  await useEntityStore.getState().loadEntities(DEFAULT_CONFIG.areas);
  await useScheduleStore.getState().loadWeek(WEEK);
  useUIStore.setState({ bootReady: true, currentPage: "plan" });
  const screen = render(<Shell />);

  expect(useScheduleStore.getState().currentWeek).toBe("2025-w24");
  const initialTitles = useScheduleStore
    .getState()
    .blocks.map((b) => b.title)
    .sort();
  expect(initialTitles).toEqual([
    "Вчерашняя задача",
    "Завтрашний созвон",
    "Сегодня deep work",
  ]);

  await userEvent.click(
    screen.getByRole("button", { name: /предыдущая неделя/i }),
  );
  await flushAllWrites();
  await expect
    .poll(() => useScheduleStore.getState().currentWeek)
    .toBe("2025-w23");

  await userEvent.click(
    screen.getByRole("button", { name: /следующая неделя/i }),
  );
  await flushAllWrites();
  await expect
    .poll(() => useScheduleStore.getState().currentWeek)
    .toBe("2025-w24");

  // Walk away again so the "Сегодня" click actually exercises the
  // goToCurrentWeek handler instead of being a no-op against the
  // already-current week.
  await userEvent.click(
    screen.getByRole("button", { name: /предыдущая неделя/i }),
  );
  await flushAllWrites();
  await expect
    .poll(() => useScheduleStore.getState().currentWeek)
    .toBe("2025-w23");

  // The .wk-today button has both a `title` attribute (accessible
  // name becomes "Вернуться к текущей неделе") and visible text
  // "Сегодня"; the planner also renders a TimeBlock whose accessible
  // name starts with "Сегодня deep work". Both getByText and
  // getByRole would fail to disambiguate. userEvent.click on a raw
  // HTMLElement times out in this vitest-browser; the native .click()
  // path triggers React's onClick correctly.
  const todayBtn = screen.container.querySelector<HTMLElement>(
    ".wk-today",
  );
  if (!todayBtn) throw new Error(".wk-today button not in DOM");
  todayBtn.click();
  await flushAllWrites();
  // loadWeek sets currentWeek before awaiting the file read, so
  // polling currentWeek alone races the blocks update. Wait for the
  // titles snapshot to match — it implies both currentWeek === w24
  // AND blocks were re-hydrated from disk/cache.
  await expect
    .poll(() =>
      useScheduleStore
        .getState()
        .blocks.map((b) => b.title)
        .sort(),
    )
    .toEqual(initialTitles);

  expect(useScheduleStore.getState().currentWeek).toBe("2025-w24");
});
