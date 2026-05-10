import { test, expect } from "vitest";
import { userEvent } from "vitest/browser";
import { render, type RenderResult } from "vitest-browser-react";
import type { Entity } from "../schemas";
import { Shell } from "../components/layout/Shell";
import { TasksPage } from "./TasksPage";
import { useConfigStore } from "../store/config";
import { useEntityStore } from "../store/entities";
import { useUIStore } from "../store/ui";
import { DEFAULT_CONFIG } from "../services/defaults";
import {
  edgeConfig,
  edgeEntities,
  screenshotEntities,
} from "../test/fixtures/edge";
import { typicalWeek } from "../test/scenarios/typical-week";
import { installFS, getCurrentFS } from "../test/virtual-fs";
import { buildTask } from "../test/builders/task";
import { flushAllWrites } from "../test/e2e/automation";

// Boots Tasks via typicalWeek — entities/config flow through real
// loadEntities. Pass entities to override the typicalWeek fixture
// in tests that need a curated mix (T-2 needs work + life tasks
// for the filter to actually narrow).
async function setupTasks(
  override?: Entity[],
): Promise<RenderResult> {
  installFS(typicalWeek());
  useConfigStore.setState({ config: DEFAULT_CONFIG });
  if (override) {
    useEntityStore.setState({ entities: override });
  } else {
    await useEntityStore
      .getState()
      .loadEntities(DEFAULT_CONFIG.areas);
  }
  useUIStore.setState({ bootReady: true, currentPage: "tasks" });
  return render(<Shell />);
}

// T-2: clicking the "Работа" sidebar button narrows the list to
// work-tagged entities and sets ui.taskFilter.
test("T-2: category filter narrows the list", async () => {
  const screen = await setupTasks([
    buildTask({ title: "Work task", tags: ["work"] }),
    buildTask({ title: "Life task", tags: ["life"] }),
  ]);

  const workBtn = screen.getByRole("button", { name: /Работа/i });
  await userEvent.click(workBtn);

  expect(useUIStore.getState().taskFilter).toEqual({
    status: null,
    cat: "work",
    prio: null,
  });
  await expect.element(screen.getByText("Work task")).toBeVisible();
  expect(
    screen.container.textContent?.includes("Life task"),
  ).toBe(false);
});

// T-3: typing into the search input filters tasks by title.
test("T-3: search filters by title", async () => {
  const screen = await setupTasks();

  const search = screen.getByPlaceholder(/Поиск задач/i);
  await userEvent.type(search, "report");

  await expect.element(screen.getByText("Test report")).toBeVisible();
  // queryByText returns null when no element matches; safer than
  // textContent.includes which would still hit display:none nodes.
  await expect
    .poll(() => screen.container.querySelector(".tr-title")?.textContent)
    .not.toContain("Daily review");
  expect(
    Array.from(
      screen.container.querySelectorAll<HTMLElement>(".tr-title"),
    ).map((el) => el.textContent),
  ).not.toContain("Daily review");
});

// T-4: legacy E1 migration — Cmd+N opens Quick Add.
test("T-4: Cmd+N opens Quick Add on Tasks", async () => {
  useConfigStore.setState({ config: edgeConfig });
  useEntityStore.setState({ entities: edgeEntities });
  useUIStore.setState({ bootReady: true, currentPage: "tasks" });

  const screen = render(<Shell />);

  await userEvent.keyboard("{Meta>}{n}{/Meta}");

  await expect
    .element(screen.getByRole("dialog", { name: /быстрое создание/i }))
    .toBeVisible();
});

// T-6: clicking the .tr-check button toggles status to "done".
test("T-6: complete checkbox toggles status to done", async () => {
  const screen = await setupTasks();
  const target = useEntityStore
    .getState()
    .entities.find((e) => e.title === "Test report");
  if (!target) throw new Error("Test report task missing");

  const button = screen.getByRole("button", {
    name: /Отметить выполненной: Test report/i,
  });
  // Playwright's hit-test fails through the Vitest iframe boundary
  // ("outside viewport") even with `force: true`. React onClick is
  // wired to a plain HTMLButtonElement, so dispatching a native
  // click directly still triggers the same handler chain.
  const buttonEl = button.element() as HTMLElement;
  buttonEl.scrollIntoView({ block: "center" });
  buttonEl.click();

  await expect
    .poll(() =>
      useEntityStore
        .getState()
        .entities.find((e) => e.id === target.id)?.status,
    )
    .toBe("done");

  await flushAllWrites();
  const fs = getCurrentFS();
  const file = JSON.parse(fs.read("/owly-test/data/entities.json"));
  const onDisk = file.entities.find(
    (e: { id: string }) => e.id === target.id,
  );
  expect(onDisk.status).toBe("done");
});

// T-7: legacy E1 migration — visual baseline of the tasks list.
test("T-7: tasks list visual baseline", async () => {
  useConfigStore.setState({ config: edgeConfig });
  useEntityStore.setState({ entities: screenshotEntities });
  useUIStore.setState({ bootReady: true, currentPage: "tasks" });

  const screen = render(<TasksPage />);

  await expect.element(screen.container).toMatchScreenshot("tasks-list");
});
