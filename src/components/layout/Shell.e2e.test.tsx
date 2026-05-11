import { beforeEach, test, expect } from "vitest";
import { userEvent } from "vitest/browser";
import { render } from "vitest-browser-react";
import { Shell } from "./Shell";
import { useConfigStore } from "../../store/config";
import { useEntityStore } from "../../store/entities";
import { useUIStore } from "../../store/ui";
import { DEFAULT_CONFIG } from "../../services/defaults";
import { installFS } from "../../test/virtual-fs";
import { typicalWeek } from "../../test/scenarios/typical-week";

function bootShell(): ReturnType<typeof render> {
  installFS(typicalWeek());
  useConfigStore.setState({ config: DEFAULT_CONFIG });
  useEntityStore.setState({ entities: [] });
  useUIStore.setState({
    bootReady: true,
    currentPage: "plan",
    tasksView: "active",
    selectedDashboardId: null,
    historyPast: [],
    historyFuture: [],
    quickAdd: { ...useUIStore.getState().quickAdd, open: false },
  });
  return render(<Shell />);
}

beforeEach(() => {
  bootShell();
});

// S-1: Cmd+[ pops one step. Plan → Tasks via setPage builds one
// history entry; the chord walks it back.
test("S-1: Cmd+[ goes back one step", async () => {
  useUIStore.getState().setPage("tasks");
  await expect.poll(() => useUIStore.getState().currentPage).toBe("tasks");

  await userEvent.keyboard("{Meta>}[BracketLeft]{/Meta}");

  await expect.poll(() => useUIStore.getState().currentPage).toBe("plan");
});

// S-2: Cmd+] walks the forward stack after a back step.
test("S-2: Cmd+] goes forward", async () => {
  useUIStore.getState().setPage("tasks");
  await userEvent.keyboard("{Meta>}[BracketLeft]{/Meta}");
  await expect.poll(() => useUIStore.getState().currentPage).toBe("plan");

  await userEvent.keyboard("{Meta>}[BracketRight]{/Meta}");

  await expect.poll(() => useUIStore.getState().currentPage).toBe("tasks");
});

// S-3: Cmd+[ restores the archive sub-view, not the forced "active"
// reset that setPage("tasks") would apply. Catches the side-effect
// regression in the history layer.
test("S-3: Cmd+[ restores tasks/archive sub-view", async () => {
  useUIStore.getState().setPage("tasks");
  useUIStore.getState().setTasksView("archive");
  useUIStore.getState().setPage("plan");

  await userEvent.keyboard("{Meta>}[BracketLeft]{/Meta}");

  await expect
    .poll(() => useUIStore.getState().currentPage)
    .toBe("tasks");
  expect(useUIStore.getState().tasksView).toBe("archive");
});

// S-4: blocking overlays suspend the chord — pressing Cmd+[ inside
// Quick Add must NOT yank the page out from under the modal.
test("S-4: Cmd+[ is a no-op while Quick Add is open", async () => {
  useUIStore.getState().setPage("tasks");
  useUIStore.getState().openQuickAdd();

  await userEvent.keyboard("{Meta>}[BracketLeft]{/Meta}");

  expect(useUIStore.getState().currentPage).toBe("tasks");
});

// S-5: empty past — pressing Cmd+[ at the start of history is a
// silent no-op (no exception, no state change, mirrors Safari).
test("S-5: Cmd+[ with empty past is a no-op", async () => {
  expect(useUIStore.getState().historyPast).toEqual([]);

  await userEvent.keyboard("{Meta>}[BracketLeft]{/Meta}");

  expect(useUIStore.getState().currentPage).toBe("plan");
  expect(useUIStore.getState().historyFuture).toEqual([]);
});

// S-6: focus in a plain text input does NOT suppress the chord —
// matches Safari address-bar behavior (Cmd+[ navigates back even
// while typing a URL).
test("S-6: Cmd+[ fires while a plain input is focused", async () => {
  useUIStore.getState().setPage("tasks");
  // Tasks renders the search input. Focus it before pressing.
  const screen = bootShell();
  useUIStore.getState().setPage("tasks");
  const input = screen.container.querySelector<HTMLInputElement>(
    'input[type="text"]',
  );
  input?.focus();

  await userEvent.keyboard("{Meta>}[BracketLeft]{/Meta}");

  await expect.poll(() => useUIStore.getState().currentPage).toBe("plan");
});
