import { test, expect } from "vitest";
import { userEvent } from "vitest/browser";
import { render, type RenderResult } from "vitest-browser-react";
import type { HorizonProjectState } from "../schemas";
import { Shell } from "../components/layout/Shell";
import { useConfigStore } from "../store/config";
import { useEntityStore } from "../store/entities";
import { useHorizonStore } from "../store/horizon";
import { usePoolStore } from "../store/pool";
import { useUIStore } from "../store/ui";
import { DEFAULT_CONFIG } from "../services/defaults";
import { typicalWeek } from "../test/scenarios/typical-week";
import { installFS, getCurrentFS, ROOT } from "../test/virtual-fs";
import { dragWithPointer } from "../test/e2e/drag";
import { flushAllWrites } from "../test/e2e/automation";

const WEEK = "2025-w24";
const HORIZON_PATH = `${ROOT}/horizon.json`;

type SeedFn = (
  byTitle: (t: string) => string,
) => HorizonProjectState[];

// Boots Horizon via typicalWeek. Project IDs auto-generate inside
// typicalWeek's builders, so the seed callback resolves them by
// title — keeps the test text-stable instead of pinning generated
// "project-N" strings that would drift if builder order shifted.
async function setupHorizon(seed: SeedFn): Promise<RenderResult> {
  const fs = typicalWeek();
  installFS(fs);
  useConfigStore.setState({ config: DEFAULT_CONFIG });
  await useEntityStore.getState().loadEntities(DEFAULT_CONFIG.areas);
  const byTitle = (t: string): string => {
    const e = useEntityStore
      .getState()
      .entities.find((x) => x.title === t && x.type === "project");
    if (!e) throw new Error(`project "${t}" not in store`);
    return e.id;
  };
  const horizon = JSON.parse(fs.read(HORIZON_PATH));
  horizon.projects = seed(byTitle);
  fs.write(HORIZON_PATH, JSON.stringify(horizon));
  await useHorizonStore.getState().load();
  await usePoolStore.getState().loadWeek(WEEK);
  useUIStore.setState({ bootReady: true, currentPage: "horizon" });
  return render(<Shell />);
}

function projectIdByTitle(title: string): string {
  const e = useEntityStore
    .getState()
    .entities.find((x) => x.title === title && x.type === "project");
  if (!e) throw new Error(`project "${title}" not in store`);
  return e.id;
}

// Locates an element inside the grid table by name. The same project
// title can appear in both the table and the backlog (e.g. an
// "Активное" project shows on both surfaces); querying via .hz-name
// — which only renders in HorizonRow — keeps the locator unambiguous
// without resorting to text search across the whole DOM.
function gridNameSpan(
  screen: RenderResult,
  title: string,
): HTMLElement {
  const spans = Array.from(
    screen.container.querySelectorAll<HTMLElement>(".hz-name span"),
  );
  const found = spans.find((el) => el.textContent === title);
  if (!found) throw new Error(`grid row for "${title}" not in DOM`);
  return found;
}

// H-3: drag a backlog item onto a month cell. useHorizonDrag picks
// the cell's window-index from `data-month` and pushes it into
// state.months — so a successful drop turns months from [] to [n]
// for one n in 0..7.
test("H-3: drag project from backlog adds to grid", async () => {
  // Anchor project keeps the grid <tbody> populated, so the target
  // .month-cell renders with non-zero height. The <tfoot> drop-row
  // exists too, but its empty <td>s collapse to ~1px and pointer
  // hit-testing through elementFromPoint picks up adjacent rows
  // instead of the cell itself. Ride on the tbody row that the
  // anchor produces.
  const screen = await setupHorizon((byTitle) => [
    {
      project_id: byTitle("Site refactor"),
      months: [],
      size: "mid",
      hidden: false,
    },
    {
      project_id: byTitle("Tuzov OS v2"),
      months: [5],
      size: "big",
      hidden: false,
    },
  ]);

  // pointerdown lives on the parent .hz-bl-item, not the inner
  // .bl-title text node — locate via closest().
  const titleEl = Array.from(
    screen.container.querySelectorAll<HTMLElement>(".hz-bl-item .bl-title"),
  ).find((el) => el.textContent === "Site refactor");
  if (!titleEl) throw new Error("Site refactor not in backlog");
  const sourceEl = titleEl.closest(".hz-bl-item") as HTMLElement | null;
  if (!sourceEl) throw new Error("backlog item parent not in DOM");

  // tbody row first — anchor row guarantees a real cell rect.
  const target = screen.container.querySelector<HTMLElement>(
    '.hz-grid tbody .month-cell[data-month="0"]',
  );
  if (!target) throw new Error("tbody month-cell[data-month=0] not in DOM");
  const r = target.getBoundingClientRect();

  await dragWithPointer(
    { element: () => sourceEl },
    { x: r.left + r.width / 2, y: r.top + r.height / 2 },
  );

  const projectId = projectIdByTitle("Site refactor");
  await expect
    .poll(
      () =>
        useHorizonStore
          .getState()
          .projects.find((p) => p.project_id === projectId)?.months.length,
    )
    .toBe(1);

  await flushAllWrites();
  const fs = getCurrentFS();
  const file = JSON.parse(fs.read(HORIZON_PATH));
  const onDisk = file.projects.find(
    (p: { project_id: string }) => p.project_id === projectId,
  );
  expect(onDisk.months.length).toBe(1);
});

// H-4: clicking the eye-button on a grid row sets hidden=true; the
// project moves to the (default-collapsed) "Скрытое" backlog section.
// We expand the section to confirm the DOM caught up with the store.
test("H-4: hide project moves to deferred section", async () => {
  const screen = await setupHorizon((byTitle) => [
    {
      project_id: byTitle("Tuzov OS v2"),
      months: [5],
      size: "mid",
      hidden: false,
    },
  ]);

  const nameSpan = gridNameSpan(screen, "Tuzov OS v2");
  const row = nameSpan.closest("tr");
  if (!row) throw new Error("Tuzov OS v2 row not in DOM");
  const hideBtn = row.querySelector<HTMLButtonElement>(
    'button[aria-label="Скрыть"]',
  );
  if (!hideBtn) throw new Error("Скрыть button not on row");
  hideBtn.click();

  const projectId = projectIdByTitle("Tuzov OS v2");
  await expect
    .poll(
      () =>
        useHorizonStore
          .getState()
          .projects.find((p) => p.project_id === projectId)?.hidden,
    )
    .toBe(true);

  // Deferred section is collapsed by default — expand to verify the
  // hidden project actually rendered there, not just flipped in store.
  const heads = Array.from(
    screen.container.querySelectorAll<HTMLElement>(".bl-section-head"),
  );
  const deferredHead = heads.find((h) =>
    h.textContent?.includes("Скрытое"),
  );
  if (!deferredHead) throw new Error("deferred section head not in DOM");
  deferredHead.click();

  await expect
    .poll(() => {
      const sections = Array.from(
        screen.container.querySelectorAll<HTMLElement>(".bl-section"),
      );
      const deferred = sections.find((s) =>
        s
          .querySelector(".bl-section-head")
          ?.textContent?.includes("Скрытое"),
      );
      if (!deferred) return null;
      const titles = Array.from(
        deferred.querySelectorAll<HTMLElement>(".hz-bl-item .bl-title"),
      ).map((el) => el.textContent);
      return titles.includes("Tuzov OS v2");
    })
    .toBe(true);

  await flushAllWrites();
  const fs = getCurrentFS();
  const file = JSON.parse(fs.read(HORIZON_PATH));
  const onDisk = file.projects.find(
    (p: { project_id: string }) => p.project_id === projectId,
  );
  expect(onDisk.hidden).toBe(true);
});

// H-5: right-click on the project name opens HorizonSizeMenu;
// selecting "Мелкий" persists size="small". userEvent.pointer with
// MouseRight surfaces the native browser context menu — raw dispatch
// of "contextmenu" hits React's onContextMenu directly, no chrome.
test("H-5: size change reorders rows", async () => {
  const screen = await setupHorizon((byTitle) => [
    {
      project_id: byTitle("Site refactor"),
      months: [5],
      size: "mid",
      hidden: false,
    },
  ]);

  const nameSpan = gridNameSpan(screen, "Site refactor");
  const nameEl = nameSpan.closest(".hz-name") as HTMLElement | null;
  if (!nameEl) throw new Error(".hz-name for Site refactor not in DOM");
  nameEl.dispatchEvent(
    new MouseEvent("contextmenu", {
      bubbles: true,
      cancelable: true,
      button: 2,
    }),
  );

  // role="menuitemradio" disambiguates from any text-only "Мелкий"
  // that might appear elsewhere in the DOM (none today, but cheap
  // insurance).
  const menuItem = screen.getByRole("menuitemradio", {
    name: /Мелкий/i,
  });
  await userEvent.click(menuItem);

  const projectId = projectIdByTitle("Site refactor");
  await expect
    .poll(
      () =>
        useHorizonStore
          .getState()
          .projects.find((p) => p.project_id === projectId)?.size,
    )
    .toBe("small");

  await flushAllWrites();
  const fs = getCurrentFS();
  const file = JSON.parse(fs.read(HORIZON_PATH));
  const onDisk = file.projects.find(
    (p: { project_id: string }) => p.project_id === projectId,
  );
  expect(onDisk.size).toBe("small");
});
