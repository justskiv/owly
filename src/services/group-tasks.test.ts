import { describe, expect, it } from "vitest";
import type { TaskEntity } from "../schemas";
import { byPriorityThenDeadline, groupTasks } from "./group-tasks";

function makeTask(overrides: Partial<TaskEntity> & { id: string }): TaskEntity {
  // `??` would silently coerce `null` to the default; spread-merge on
  // a complete base preserves explicit nulls passed in for priority /
  // deadline.
  const base: TaskEntity = {
    type: "task",
    id: overrides.id,
    title: `Task ${overrides.id}`,
    tags: ["life"],
    status: "active",
    priority: "medium",
    deadline: null,
    estimated_minutes: null,
    description: "",
    created_at: "2026-04-01T00:00:00",
    updated_at: "2026-04-01T00:00:00",
    fields: { parent_project_id: null, checklist: [] },
  };
  return { ...base, ...overrides };
}

const APR29 = new Date(2026, 3, 29);

describe("groupTasks", () => {
  it("returns all empty groups for empty input", () => {
    const g = groupTasks([], [], APR29);
    expect(g.burning).toEqual([]);
    expect(g.urgent).toEqual([]);
    expect(g.soon).toEqual([]);
    expect(g.someday).toEqual([]);
    expect(g.done).toEqual([]);
  });

  it("places overdue and 0..2-day tasks in burning", () => {
    const t1 = makeTask({ id: "t1", deadline: "2026-04-25" });
    const t2 = makeTask({ id: "t2", deadline: "2026-04-29" });
    const t3 = makeTask({ id: "t3", deadline: "2026-05-01" });
    const g = groupTasks([t1, t2, t3], [], APR29);
    expect(g.burning.map((t) => t.id).sort()).toEqual(["t1", "t2", "t3"]);
  });

  it("places 3..7 days in urgent", () => {
    const t1 = makeTask({ id: "t1", deadline: "2026-05-02", priority: "low" });
    const t2 = makeTask({ id: "t2", deadline: "2026-05-06", priority: "low" });
    const g = groupTasks([t1, t2], [], APR29);
    expect(g.urgent.map((t) => t.id)).toEqual(["t1", "t2"]);
  });

  it("places 8..30 days in soon", () => {
    const t1 = makeTask({ id: "t1", deadline: "2026-05-10" });
    const t2 = makeTask({ id: "t2", deadline: "2026-05-29" });
    const g = groupTasks([t1, t2], [], APR29);
    expect(g.soon.map((t) => t.id)).toEqual(["t1", "t2"]);
  });

  it("places null deadline and >30 in someday", () => {
    const t1 = makeTask({ id: "t1", deadline: null });
    const t2 = makeTask({ id: "t2", deadline: "2026-07-01" });
    const g = groupTasks([t1, t2], [], APR29);
    expect(g.someday.map((t) => t.id).sort()).toEqual(["t1", "t2"]);
  });

  it("done tasks go to done group regardless of deadline", () => {
    const d1 = makeTask({ id: "d1", status: "done", deadline: "2026-04-29" });
    const g = groupTasks([], [d1], APR29);
    expect(g.done.map((t) => t.id)).toEqual(["d1"]);
    expect(g.burning).toEqual([]);
  });

  it("sorts within group: priority high→low, then deadline asc", () => {
    const t1 = makeTask({ id: "t1", deadline: "2026-04-30", priority: "low" });
    const t2 = makeTask({ id: "t2", deadline: "2026-05-01", priority: "high" });
    const t3 = makeTask({ id: "t3", deadline: "2026-04-29", priority: "high" });
    const g = groupTasks([t1, t2, t3], [], APR29);
    expect(g.burning.map((t) => t.id)).toEqual(["t3", "t2", "t1"]);
  });

  it("nulls go after non-nulls in same priority bucket", () => {
    const t1 = makeTask({ id: "t1", deadline: null, priority: null });
    const t2 = makeTask({ id: "t2", deadline: "2026-08-01", priority: null });
    const g = groupTasks([t1, t2], [], APR29);
    expect(g.someday.map((t) => t.id)).toEqual(["t2", "t1"]);
  });
});

describe("byPriorityThenDeadline", () => {
  it("high before medium before low before null", () => {
    const high = makeTask({ id: "h", priority: "high" });
    const medium = makeTask({ id: "m", priority: "medium" });
    const low = makeTask({ id: "l", priority: "low" });
    const none = makeTask({ id: "n", priority: null });
    const sorted = [none, low, high, medium].sort(byPriorityThenDeadline);
    expect(sorted.map((t) => t.id)).toEqual(["h", "m", "l", "n"]);
  });
});
