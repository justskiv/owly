import { beforeEach, describe, expect, test } from "vitest";
import { useUIStore, type NavSnap } from "./ui";

// Resets just the navigation-relevant slice between tests so each
// case starts from a known baseline. We intentionally don't wipe
// the whole store — leaving the rest of the defaults intact mirrors
// real boot state where other slots already carry sensible values.
function resetNav(overrides: Partial<{
  currentPage: NavSnap["page"];
  tasksView: NavSnap["tasksView"];
  selectedDashboardId: NavSnap["selectedDashboardId"];
  horizonHighlight: { projectId: string; fixed: boolean } | null;
  lastCreatedTaskId: string | null;
}> = {}): void {
  useUIStore.setState({
    currentPage: "plan",
    tasksView: "active",
    selectedDashboardId: null,
    horizonHighlight: null,
    lastCreatedTaskId: null,
    historyPast: [],
    historyFuture: [],
    ...overrides,
  });
}

function curSnap(): NavSnap {
  const s = useUIStore.getState();
  return {
    page: s.currentPage,
    tasksView: s.tasksView,
    selectedDashboardId: s.selectedDashboardId,
  };
}

describe("nav history — navigate semantics", () => {
  beforeEach(() => resetNav());

  test("initial state has empty past and future", () => {
    expect(useUIStore.getState().historyPast).toEqual([]);
    expect(useUIStore.getState().historyFuture).toEqual([]);
  });

  test("navigate to a different page pushes old onto past", () => {
    useUIStore.getState().setPage("tasks");
    const s = useUIStore.getState();
    expect(s.currentPage).toBe("tasks");
    expect(s.historyPast).toEqual([
      { page: "plan", tasksView: "active", selectedDashboardId: null },
    ]);
    expect(s.historyFuture).toEqual([]);
  });

  test("navigate to the same snap is a no-op", () => {
    useUIStore.getState().setPage("plan");
    expect(useUIStore.getState().historyPast).toEqual([]);
    expect(useUIStore.getState().currentPage).toBe("plan");
  });

  test("new user nav clears future", () => {
    useUIStore.getState().setPage("tasks");
    useUIStore.getState().goBack();
    expect(useUIStore.getState().historyFuture).toHaveLength(1);
    useUIStore.getState().setPage("projects");
    expect(useUIStore.getState().historyFuture).toEqual([]);
  });

  test("successive equal setPage calls coalesce", () => {
    useUIStore.getState().setPage("tasks");
    useUIStore.getState().setPage("tasks");
    expect(useUIStore.getState().historyPast).toHaveLength(1);
  });
});

describe("nav history — back / forward", () => {
  beforeEach(() => resetNav());

  test("goBack with empty past is a no-op", () => {
    useUIStore.getState().goBack();
    const s = useUIStore.getState();
    expect(s.currentPage).toBe("plan");
    expect(s.historyPast).toEqual([]);
    expect(s.historyFuture).toEqual([]);
  });

  test("goForward with empty future is a no-op", () => {
    useUIStore.getState().goForward();
    expect(useUIStore.getState().historyFuture).toEqual([]);
  });

  test("goBack pops past and pushes current to future", () => {
    useUIStore.getState().setPage("tasks");
    useUIStore.getState().goBack();
    const s = useUIStore.getState();
    expect(s.currentPage).toBe("plan");
    expect(s.historyPast).toEqual([]);
    expect(s.historyFuture).toEqual([
      { page: "tasks", tasksView: "active", selectedDashboardId: null },
    ]);
  });

  test("goForward pops future and pushes current to past", () => {
    useUIStore.getState().setPage("tasks");
    useUIStore.getState().goBack();
    useUIStore.getState().goForward();
    const s = useUIStore.getState();
    expect(s.currentPage).toBe("tasks");
    expect(s.historyPast).toEqual([
      { page: "plan", tasksView: "active", selectedDashboardId: null },
    ]);
    expect(s.historyFuture).toEqual([]);
  });

  test("back/forward through three steps walks linearly", () => {
    useUIStore.getState().setPage("tasks");
    useUIStore.getState().setPage("projects");
    useUIStore.getState().setPage("review");
    useUIStore.getState().goBack();
    expect(useUIStore.getState().currentPage).toBe("projects");
    useUIStore.getState().goBack();
    expect(useUIStore.getState().currentPage).toBe("tasks");
    useUIStore.getState().goBack();
    expect(useUIStore.getState().currentPage).toBe("plan");
    useUIStore.getState().goForward();
    expect(useUIStore.getState().currentPage).toBe("tasks");
  });

  test("restore does not push onto past again (no loops)", () => {
    useUIStore.getState().setPage("tasks");
    const beforeBack = useUIStore.getState().historyPast.length;
    useUIStore.getState().goBack();
    expect(useUIStore.getState().historyPast.length).toBe(beforeBack - 1);
  });
});

describe("nav history — setPage side effects", () => {
  beforeEach(() => resetNav());

  test("setPage('tasks') from tasksView=archive forces 'active'", () => {
    resetNav({ tasksView: "archive" });
    useUIStore.getState().setPage("plan");
    useUIStore.getState().setPage("tasks");
    expect(useUIStore.getState().tasksView).toBe("active");
  });

  test("regression: back to tasks/archive after switching pages", () => {
    // Phase 10 invariant — once a user goes Tasks→Archive→Plan, the
    // back step must restore the Archive sub-view, not the active
    // one. Pre-history-refactor this would have failed because
    // setPage("tasks") force-resets tasksView to "active".
    useUIStore.getState().setPage("tasks");
    useUIStore.getState().setTasksView("archive");
    useUIStore.getState().setPage("plan");
    useUIStore.getState().goBack();
    expect(curSnap()).toEqual({
      page: "tasks",
      tasksView: "archive",
      selectedDashboardId: null,
    });
  });

  test("leaving horizon clears horizonHighlight", () => {
    resetNav({
      currentPage: "horizon",
      horizonHighlight: { projectId: "p1", fixed: true },
    });
    useUIStore.getState().setPage("plan");
    expect(useUIStore.getState().horizonHighlight).toBeNull();
  });

  test("lastCreatedTaskId cleared on page transition", () => {
    resetNav({ currentPage: "tasks", lastCreatedTaskId: "t1" });
    useUIStore.getState().setPage("plan");
    expect(useUIStore.getState().lastCreatedTaskId).toBeNull();
  });

  test("lastCreatedTaskId preserved on view-only transition", () => {
    resetNav({ currentPage: "tasks", lastCreatedTaskId: "t1" });
    useUIStore.getState().setTasksView("archive");
    expect(useUIStore.getState().lastCreatedTaskId).toBe("t1");
  });
});

describe("nav history — dashboards & misc", () => {
  beforeEach(() => resetNav());

  test("selectedDashboardId is part of history", () => {
    resetNav({ currentPage: "dashboards" });
    useUIStore.getState().setSelectedDashboard("dash-1");
    useUIStore.getState().setSelectedDashboard(null);
    useUIStore.getState().goBack();
    expect(useUIStore.getState().selectedDashboardId).toBe("dash-1");
  });

  test("history cap drops oldest entries", () => {
    // 51 distinct pushes (cap is 50): the very first state should
    // fall off the bottom of historyPast.
    const pages: NavSnap["page"][] = [
      "plan", "tasks", "projects", "context", "horizon", "review",
    ];
    for (let i = 0; i < 60; i++) {
      useUIStore.getState().setPage(pages[i % pages.length]);
    }
    const past = useUIStore.getState().historyPast;
    expect(past.length).toBeLessThanOrEqual(50);
    expect(past.length).toBe(50);
  });
});
