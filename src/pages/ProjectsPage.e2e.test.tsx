import { test, expect } from "vitest";
import { userEvent } from "vitest/browser";
import { render, type RenderResult } from "vitest-browser-react";
import { Shell } from "../components/layout/Shell";
import { useConfigStore } from "../store/config";
import { useEntityStore } from "../store/entities";
import { usePoolStore } from "../store/pool";
import { useUIStore } from "../store/ui";
import { DEFAULT_CONFIG } from "../services/defaults";
import { typicalWeek } from "../test/scenarios/typical-week";
import { installFS, getCurrentFS } from "../test/virtual-fs";
import { dragWithPointer } from "../test/e2e/drag";
import { flushAllWrites } from "../test/e2e/automation";

const WEEK = "2025-w24";
const ENTITIES_PATH = "/tuzov-test/data/entities.json";
const ACTIVE_BOARD = "brd3";

// Boots Projects via typicalWeek — entities loaded through real
// loadEntities path. ACTIVE_BOARD is set explicitly because the UI
// store's default is "brd1", but typicalWeek's projects (Site refactor,
// Tuzov OS v2) sit on board "brd3" — without the override the kanban
// renders an empty Видео board.
async function setupProjects(): Promise<RenderResult> {
  installFS(typicalWeek());
  useConfigStore.setState({ config: DEFAULT_CONFIG });
  await useEntityStore.getState().loadEntities(DEFAULT_CONFIG.areas);
  await usePoolStore.getState().loadWeek(WEEK);
  useUIStore.setState({
    bootReady: true,
    currentPage: "projects",
    activeBoard: ACTIVE_BOARD,
  });
  return render(<Shell />);
}

// Pr-1: kanban renders 5 columns and shows seeded projects in col 0.
test("Pr-1: renders kanban for active board", async () => {
  const screen = await setupProjects();

  expect(screen.container.querySelector(".kanban")).toBeTruthy();

  const columns = screen.container.querySelectorAll<HTMLElement>(
    "[data-column-index]",
  );
  // brd3 ("Разное") has 5 columns: Надо/Начал/Делаю/Почти/Готово.
  expect(columns.length).toBe(5);

  await expect.element(screen.getByText("Site refactor")).toBeVisible();
  await expect.element(screen.getByText("Tuzov OS v2")).toBeVisible();

  // First column heading text — guards against board mis-routing
  // (would render "Идея" if activeBoard slipped to brd1/brd2).
  const firstHead = screen.container.querySelector<HTMLElement>(
    ".kanban-col .kanban-col-head span",
  );
  expect(firstHead?.textContent).toBe("Надо");
});

// Pr-4: drag a kanban card from col 0 to col 1. Persists column_index
// and resets last_activity_days (drop contract in useKanbanGesture).
test("Pr-4: drag card between columns updates column_index", async () => {
  const screen = await setupProjects();

  // pointerdown is captured on the parent .kanban-card, not the inner
  // .kc-title text node — locate the card via closest().
  const titleEl = screen.getByText("Site refactor").element() as HTMLElement;
  const card = titleEl.closest(".kanban-card") as HTMLElement | null;
  if (!card) throw new Error("kanban-card for Site refactor not in DOM");

  const target = screen.container.querySelector<HTMLElement>(
    '[data-column-index="1"]',
  );
  if (!target) throw new Error("column 1 not in DOM");
  const r = target.getBoundingClientRect();

  await dragWithPointer(
    { element: () => card },
    { x: r.left + r.width / 2, y: r.top + r.height / 2 },
  );

  await expect
    .poll(() => {
      const e = useEntityStore
        .getState()
        .entities.find((x) => x.title === "Site refactor");
      return e?.type === "project" ? e.fields.column_index : undefined;
    })
    .toBe(1);

  // Drop sets last_activity_days to 0 — the move counts as activity.
  const moved = useEntityStore
    .getState()
    .entities.find((e) => e.title === "Site refactor");
  if (!moved || moved.type !== "project") {
    throw new Error("moved entity not a project");
  }
  expect(moved.fields.last_activity_days).toBe(0);

  await flushAllWrites();
  const fs = getCurrentFS();
  const file = JSON.parse(fs.read(ENTITIES_PATH));
  const onDisk = file.entities.find(
    (e: { title: string }) => e.title === "Site refactor",
  );
  expect(onDisk.fields.column_index).toBe(1);
});

// Pr-5: inline-create a card via the per-column "+ Проект" trigger.
// New project inherits the column's index and the active board.
test("Pr-5: inline create card in column adds entity", async () => {
  const screen = await setupProjects();

  const trigger = screen.container.querySelector<HTMLButtonElement>(
    '[data-column-index="0"] .ia-trigger',
  );
  if (!trigger) throw new Error("InlineAdd trigger missing in column 0");
  await userEvent.click(trigger);

  const input = screen.getByPlaceholder(/Название проекта/i);
  await userEvent.type(input, "New kanban project");
  await userEvent.keyboard("{Enter}");

  await expect
    .poll(() =>
      useEntityStore
        .getState()
        .entities.some(
          (e) => e.type === "project" && e.title === "New kanban project",
        ),
    )
    .toBe(true);

  const created = useEntityStore
    .getState()
    .entities.find((e) => e.title === "New kanban project");
  if (!created || created.type !== "project") {
    throw new Error("created project not found in store");
  }
  expect(created.fields.column_index).toBe(0);
  expect(created.fields.board_id).toBe(ACTIVE_BOARD);
  expect(created.tags).toContain("work");

  await flushAllWrites();
  const fs = getCurrentFS();
  const file = JSON.parse(fs.read(ENTITIES_PATH));
  expect(
    file.entities.some(
      (e: { title: string }) => e.title === "New kanban project",
    ),
  ).toBe(true);
});

// Pr-6: tap a card without crossing DRAG_THRESHOLD — useKanbanGesture
// teardown("click") fires `onClick`, which opens the entity popup.
test("Pr-6: click card opens entity popup", async () => {
  const screen = await setupProjects();

  const titleEl = screen.getByText("Site refactor").element() as HTMLElement;
  const card = titleEl.closest(".kanban-card") as HTMLElement | null;
  if (!card) throw new Error("kanban-card for Site refactor not in DOM");
  const target = useEntityStore
    .getState()
    .entities.find((e) => e.title === "Site refactor");
  if (!target) throw new Error("Site refactor entity missing");

  // pointerdown on the card, pointerup on window with the same coords
  // — useKanbanGesture binds pointerup/move to window, not the source.
  // Zero movement keeps `moved=false` so teardown picks "click" branch.
  const r = card.getBoundingClientRect();
  const x = r.left + r.width / 2;
  const y = r.top + r.height / 2;
  card.dispatchEvent(
    new PointerEvent("pointerdown", {
      bubbles: true,
      clientX: x,
      clientY: y,
      pointerId: 1,
      button: 0,
      isPrimary: true,
    }),
  );
  window.dispatchEvent(
    new PointerEvent("pointerup", {
      bubbles: true,
      clientX: x,
      clientY: y,
      pointerId: 1,
    }),
  );

  await expect
    .poll(() => useUIStore.getState().entityPopup.open)
    .toBe(true);
  const popup = useUIStore.getState().entityPopup;
  if (!popup.open) throw new Error("popup not open after click");
  expect(popup.entityId).toBe(target.id);
  expect(screen.container.querySelector(".entity-popup")).toBeTruthy();
});
