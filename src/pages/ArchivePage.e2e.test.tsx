import { test, expect } from "vitest";
import { userEvent } from "vitest/browser";
import { render, type RenderResult } from "vitest-browser-react";
import type { TaskEntity } from "../schemas";
import { Shell } from "../components/layout/Shell";
import { useConfigStore } from "../store/config";
import { useEntityStore } from "../store/entities";
import { useUIStore } from "../store/ui";
import { DEFAULT_CONFIG } from "../services/defaults";
import { installFS } from "../test/virtual-fs";
import { typicalWeek } from "../test/scenarios/typical-week";
import { buildTask } from "../test/builders/task";
import { flushAllWrites } from "../test/e2e/automation";

// Builds a minimal done task with explicit completed_at — buildTask
// defaults `status` to active and `completed_at` to null, which is
// the wrong shape for archive-screen tests.
function buildDone(
  overrides: Partial<TaskEntity> & { id: string; completed_at: string },
): TaskEntity {
  return buildTask({
    title: `Done ${overrides.id}`,
    status: "done",
    ...overrides,
  });
}

async function setupArchive(
  doneTasks: TaskEntity[],
  opts: { active?: TaskEntity[]; tasksView?: "active" | "archive" } = {},
): Promise<RenderResult> {
  installFS(typicalWeek());
  useConfigStore.setState({ config: DEFAULT_CONFIG });
  useEntityStore.setState({ entities: [...(opts.active ?? []), ...doneTasks] });
  useUIStore.setState({
    bootReady: true,
    currentPage: "tasks",
    tasksView: opts.tasksView ?? "archive",
  });
  return render(<Shell />);
}

// A-1: clicking the archive entry-card on TasksSidebar switches the
// Tasks tab into archive view. The chrome (TopNav, sidebar) stays
// mounted — we just swap TasksPage for ArchivePage in <main>.
test("A-1: entry-card opens ArchivePage", async () => {
  const screen = await setupArchive(
    [buildDone({ id: "d1", completed_at: "2026-05-01T10:00:00" })],
    { tasksView: "active" },
  );

  const entry = screen.getByRole("button", { name: /Архив выполненных/i });
  await userEvent.click(entry);

  await expect
    .element(screen.getByRole("heading", { name: "Архив" }))
    .toBeVisible();
  expect(useUIStore.getState().tasksView).toBe("archive");
});

// A-2: ArchivePage exposes search + sort + back affordances.
test("A-2: ArchivePage shows search, sort, and back button", async () => {
  const screen = await setupArchive([
    buildDone({ id: "d1", completed_at: "2026-05-01T10:00:00" }),
  ]);

  await expect
    .element(screen.getByPlaceholder("Поиск"))
    .toBeVisible();
  await expect.element(screen.getByRole("combobox")).toBeVisible();
  await expect
    .element(screen.getByRole("button", { name: /Назад к задачам/i }))
    .toBeVisible();
});

// A-3: typing in search narrows to titles that contain the query.
test("A-3: search narrows the archive list", async () => {
  const screen = await setupArchive([
    buildDone({
      id: "d1",
      title: "Buy groceries",
      completed_at: "2026-05-08T10:00:00",
    }),
    buildDone({
      id: "d2",
      title: "Refactor planner",
      completed_at: "2026-05-07T10:00:00",
    }),
  ]);

  const search = screen.getByPlaceholder("Поиск");
  await userEvent.type(search, "groc");

  await expect.element(screen.getByText("Buy groceries")).toBeVisible();
  expect(
    screen.container.textContent?.includes("Refactor planner"),
  ).toBe(false);
});

// A-4: switching sort flips order. Defaults to completed_desc; we
// switch to completed_asc and assert the older row appears first.
test("A-4: sort toggles row order", async () => {
  const screen = await setupArchive([
    buildDone({
      id: "d1",
      title: "Recent task",
      completed_at: "2026-05-08T10:00:00",
    }),
    buildDone({
      id: "d2",
      title: "Old task",
      completed_at: "2026-04-10T10:00:00",
    }),
  ]);

  // Wait for the page to mount before reaching for the select.
  await expect.element(screen.getByRole("combobox")).toBeVisible();
  const select = screen.getByRole("combobox").element() as HTMLSelectElement;
  select.value = "completed_asc";
  select.dispatchEvent(new Event("change", { bubbles: true }));

  await expect.poll(() => useUIStore.getState().archiveSort).toBe(
    "completed_asc",
  );
  // First arch-row in the DOM should be the older one.
  await expect
    .poll(
      () =>
        screen.container.querySelector<HTMLElement>(".ar-title")?.textContent,
    )
    .toBe("Old task");
});

// A-5: clicking the row's checkbox restores the task — its status
// flips to active, completed_at clears, and it disappears from the
// archive view in real time.
test("A-5: restore via checkbox removes the task and clears completed_at", async () => {
  const target = buildDone({
    id: "d1",
    title: "Restore me",
    completed_at: "2026-05-08T10:00:00",
  });
  const screen = await setupArchive([target]);

  const button = screen.getByRole("button", {
    name: /Вернуть в работу: Restore me/i,
  });
  await expect.element(button).toBeVisible();
  const buttonEl = button.element() as HTMLElement;
  buttonEl.scrollIntoView({ block: "center" });
  buttonEl.click();

  await expect
    .poll(() =>
      useEntityStore.getState().entities.find((e) => e.id === "d1")?.status,
    )
    .toBe("active");
  await expect
    .poll(() => {
      const e = useEntityStore.getState().entities.find((x) => x.id === "d1");
      return e && "completed_at" in e ? e.completed_at : "missing";
    })
    .toBe(null);
  await flushAllWrites();
});

// A-6: back-button returns to the active list.
test("A-6: back button returns to TasksPage", async () => {
  const screen = await setupArchive([
    buildDone({ id: "d1", completed_at: "2026-05-08T10:00:00" }),
  ]);

  const back = screen.getByRole("button", { name: /Назад к задачам/i });
  await expect.element(back).toBeVisible();
  await userEvent.click(back);

  expect(useUIStore.getState().tasksView).toBe("active");
});

// A-7: navigating away and back to Tasks resets archive view.
test("A-7: setPage('tasks') resets tasksView to 'active'", async () => {
  await setupArchive([
    buildDone({ id: "d1", completed_at: "2026-05-08T10:00:00" }),
  ]);

  useUIStore.getState().setPage("plan");
  expect(useUIStore.getState().tasksView).toBe("archive"); // unchanged

  useUIStore.getState().setPage("tasks");
  expect(useUIStore.getState().tasksView).toBe("active");
});

// A-8: Escape on the archive page returns to the active list when
// search is empty (or focus is outside search).
test("A-8: Escape exits archive", async () => {
  await setupArchive([
    buildDone({ id: "d1", completed_at: "2026-05-08T10:00:00" }),
  ]);

  await userEvent.keyboard("{Escape}");

  await expect.poll(() => useUIStore.getState().tasksView).toBe("active");
});
