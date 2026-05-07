import { test, expect } from "vitest";
import { userEvent } from "vitest/browser";
import { render, type RenderResult } from "vitest-browser-react";
import { Shell } from "../components/layout/Shell";
import { useConfigStore } from "../store/config";
import { useEntityStore } from "../store/entities";
import { usePoolStore } from "../store/pool";
import { useUIStore } from "../store/ui";
import { DEFAULT_CONFIG } from "../services/defaults";
import { FALLBACK_BOARD_ID } from "../services/boards";
import { typicalWeek } from "../test/scenarios/typical-week";
import { installFS, getCurrentFS, ROOT } from "../test/virtual-fs";
import { dragWithPointer } from "../test/e2e/drag";
import { flushAllWrites } from "../test/e2e/automation";

const WEEK = "2025-w24";
const ENTITIES_PATH = `${ROOT}/entities.json`;
// typicalWeek's seeded projects sit on FALLBACK_BOARD_ID ("brd3").
// The store default activeBoard is "brd1", so setupProjects has to
// override — see comment on setupProjects.
const ACTIVE_BOARD = FALLBACK_BOARD_ID;

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

  // All 5 column headings, in order — guards both board mis-routing
  // (brd1/brd2 would label them "Идея/Сценарий/…") and column reorder.
  const heads = Array.from(
    screen.container.querySelectorAll<HTMLElement>(
      ".kanban-col .kanban-col-head span:first-child",
    ),
  ).map((el) => el.textContent);
  expect(heads).toEqual(["Надо", "Начал", "Делаю", "Почти", "Готово"]);
});

// Pr-4: drag a kanban card from col 0 to col 1. Persists column_index
// and resets last_activity_days (drop contract in useKanbanGesture).
test("Pr-4: drag card between columns updates column_index", async () => {
  const screen = await setupProjects();

  // Pre-seed the dragged card with non-zero activity so the post-drop
  // `=== 0` assertion is honest. buildProject defaults to 0, which
  // would let the test pass even if the gesture skipped the reset.
  useEntityStore.setState((s) => ({
    entities: s.entities.map((e) =>
      e.type === "project" && e.title === "Site refactor"
        ? { ...e, fields: { ...e.fields, last_activity_days: 15 } }
        : e,
    ),
  }));

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
  // Combined with the seed=15 above, this catches a regression where
  // the reset is dropped but column_index still moves.
  const moved = useEntityStore
    .getState()
    .entities.find((e) => e.title === "Site refactor");
  if (!moved || moved.type !== "project") {
    throw new Error("moved entity not a project");
  }
  expect(moved.fields.last_activity_days).toBe(0);

  // Wait for the persist-first ghost to be removed before locating
  // the moved card — otherwise getByText("Site refactor") matches both
  // the rendered card and the still-mounted ghost (strict-mode error).
  await expect
    .poll(() => document.querySelectorAll(".drag-ghost").length)
    .toBe(0);

  // Visual move — store update alone doesn't prove KanbanColumn
  // re-rendered the card under its new parent.
  const movedTitleEl = screen
    .getByText("Site refactor")
    .element() as HTMLElement;
  const newCard = movedTitleEl.closest(".kanban-card");
  expect(newCard?.closest('[data-column-index="1"]')).not.toBeNull();

  await flushAllWrites();
  const fs = getCurrentFS();
  const file = JSON.parse(fs.read(ENTITIES_PATH));
  const onDisk = file.entities.find(
    (e: { title: string }) => e.title === "Site refactor",
  );
  expect(onDisk.fields.column_index).toBe(1);
  expect(onDisk.fields.last_activity_days).toBe(0);
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

  // Assert popup CONTENT, not just openness. EntityPopupContent could
  // render `.ep-stub` or the wrong sub-popup type, and a store-only
  // assertion would not catch that. ProjectPopup renders an input with
  // `aria-label="Название проекта"` and value=titleDraft; the visible
  // value proves both "popup is open" and "the right entity loaded".
  const titleInput = (await screen
    .getByLabelText("Название проекта")
    .element()) as HTMLInputElement;
  expect(titleInput.value).toBe("Site refactor");
  expect(titleInput.closest(".entity-popup")).not.toBeNull();
});
