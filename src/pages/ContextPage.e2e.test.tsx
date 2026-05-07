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
import { flushAllWrites } from "../test/e2e/automation";

const WEEK = "2025-w24";
const ENTITIES_PATH = "/tuzov-test/data/entities.json";

// Boots Context via typicalWeek. typicalWeek seeds one direction
// ("YouTube") with tags=["work"] — only the work CategorySection is
// rendered (CategorySection short-circuits on empty directions).
async function setupContext(): Promise<RenderResult> {
  installFS(typicalWeek());
  useConfigStore.setState({ config: DEFAULT_CONFIG });
  await useEntityStore.getState().loadEntities(DEFAULT_CONFIG.areas);
  await usePoolStore.getState().loadWeek(WEEK);
  useUIStore.setState({ bootReady: true, currentPage: "context" });
  return render(<Shell />);
}

// C-1: only sections with directions render — typicalWeek seeds one
// direction in work, so we expect a single section with one card.
test("C-1: renders direction grid grouped by area", async () => {
  const screen = await setupContext();

  const sections = screen.container.querySelectorAll(".cat-section");
  expect(sections.length).toBe(1);

  // .cs-label renders area.label.toUpperCase() — DEFAULT_CONFIG's
  // work area has label "Работа", so the visible header is "РАБОТА".
  const label = sections[0].querySelector(".cs-label");
  expect(label?.textContent).toBe("РАБОТА");

  const cards = sections[0].querySelectorAll(".dir-card");
  expect(cards.length).toBe(1);
  expect(cards[0].querySelector(".dc-title")?.textContent).toBe("YouTube");
});

// C-3: open InlineCreateDirection inside the work section, type a
// title, commit with Enter. New entity inherits the section's area.
test("C-3: inline create new direction in section", async () => {
  const screen = await setupContext();

  const section = screen.container.querySelector<HTMLElement>(".cat-section");
  if (!section) throw new Error("work cat-section not in DOM");
  const trigger = section.querySelector<HTMLButtonElement>(".add-trigger");
  if (!trigger) throw new Error("InlineCreateDirection trigger missing");
  await userEvent.click(trigger);

  const input = screen.getByPlaceholder(/Название направления/i);
  await userEvent.type(input, "New direction");
  await userEvent.keyboard("{Enter}");

  await expect
    .poll(() =>
      useEntityStore
        .getState()
        .entities.some(
          (e) => e.type === "direction" && e.title === "New direction",
        ),
    )
    .toBe(true);

  const created = useEntityStore
    .getState()
    .entities.find((e) => e.title === "New direction");
  expect(created?.tags).toContain("work");

  await flushAllWrites();
  const fs = getCurrentFS();
  const file = JSON.parse(fs.read(ENTITIES_PATH));
  expect(
    file.entities.some(
      (e: { title: string; type: string }) =>
        e.type === "direction" && e.title === "New direction",
    ),
  ).toBe(true);
});

// C-4: the "+ Проект" button on a direction card opens an inline
// project editor; submitting links the new project to the direction.
test("C-4: inline create project inside direction card", async () => {
  const screen = await setupContext();

  const youTube = Array.from(
    screen.container.querySelectorAll<HTMLElement>(".dir-card"),
  ).find((c) => c.querySelector(".dc-title")?.textContent === "YouTube");
  if (!youTube) throw new Error("YouTube dir-card not in DOM");
  const dirEntity = useEntityStore
    .getState()
    .entities.find(
      (e) => e.type === "direction" && e.title === "YouTube",
    );
  if (!dirEntity) throw new Error("YouTube direction missing in store");

  const addBtn = Array.from(
    youTube.querySelectorAll<HTMLButtonElement>("button"),
  ).find((b) => b.textContent?.includes("+ Проект"));
  if (!addBtn) throw new Error("+ Проект button missing on YouTube card");
  await userEvent.click(addBtn);

  const input = screen.getByPlaceholder(/Проект для/);
  await userEvent.type(input, "Inline project");
  await userEvent.keyboard("{Enter}");

  await expect
    .poll(() =>
      useEntityStore
        .getState()
        .entities.some(
          (e) => e.type === "project" && e.title === "Inline project",
        ),
    )
    .toBe(true);

  const created = useEntityStore
    .getState()
    .entities.find((e) => e.title === "Inline project");
  if (!created || created.type !== "project") {
    throw new Error("created project not found in store");
  }
  expect(created.fields.direction_id).toBe(dirEntity.id);
  expect(created.fields.board_id).toBe("brd3");
  expect(created.fields.column_index).toBe(0);
  expect(created.tags).toContain("work");

  await flushAllWrites();
  const fs = getCurrentFS();
  const file = JSON.parse(fs.read(ENTITIES_PATH));
  const onDisk = file.entities.find(
    (e: { title: string }) => e.title === "Inline project",
  );
  expect(onDisk.fields.direction_id).toBe(dirEntity.id);
});
