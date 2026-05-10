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
    completed_at: null,
    fields: { parent_project_id: null, checklist: [] },
  };
  return { ...base, ...overrides };
}

const APR29 = new Date(2026, 3, 29);

describe("groupTasks", () => {
  it("returns all empty groups for empty input", () => {
    const g = groupTasks([], APR29);
    expect(g.burning).toEqual([]);
    expect(g.urgent).toEqual([]);
    expect(g.soon).toEqual([]);
    expect(g.notSoon).toEqual([]);
    expect(g.someday).toEqual([]);
  });

  it("places overdue and 0..2-day tasks in burning", () => {
    const t1 = makeTask({ id: "t1", deadline: "2026-04-25" });
    const t2 = makeTask({ id: "t2", deadline: "2026-04-29" });
    const t3 = makeTask({ id: "t3", deadline: "2026-05-01" });
    const g = groupTasks([t1, t2, t3], APR29);
    expect(g.burning.map((t) => t.id).sort()).toEqual(["t1", "t2", "t3"]);
  });

  it("places 3..7 days in urgent", () => {
    const t1 = makeTask({ id: "t1", deadline: "2026-05-02", priority: "low" });
    const t2 = makeTask({ id: "t2", deadline: "2026-05-06", priority: "low" });
    const g = groupTasks([t1, t2], APR29);
    expect(g.urgent.map((t) => t.id)).toEqual(["t1", "t2"]);
  });

  it("places 8..30 days in soon", () => {
    const t1 = makeTask({ id: "t1", deadline: "2026-05-10" });
    const t2 = makeTask({ id: "t2", deadline: "2026-05-29" });
    const g = groupTasks([t1, t2], APR29);
    expect(g.soon.map((t) => t.id)).toEqual(["t1", "t2"]);
  });

  it("places null deadline in someday only", () => {
    const t1 = makeTask({ id: "t1", deadline: null });
    const g = groupTasks([t1], APR29);
    expect(g.someday.map((t) => t.id)).toEqual(["t1"]);
    expect(g.notSoon).toEqual([]);
  });

  it("places >30 days in notSoon, not someday", () => {
    const t = makeTask({ id: "t", deadline: "2026-07-01" });
    const g = groupTasks([t], APR29);
    expect(g.notSoon.map((x) => x.id)).toEqual(["t"]);
    expect(g.someday).toEqual([]);
  });

  it("sorts within group: priority high→low, then deadline asc", () => {
    const t1 = makeTask({ id: "t1", deadline: "2026-04-30", priority: "low" });
    const t2 = makeTask({ id: "t2", deadline: "2026-05-01", priority: "high" });
    const t3 = makeTask({ id: "t3", deadline: "2026-04-29", priority: "high" });
    const g = groupTasks([t1, t2, t3], APR29);
    expect(g.burning.map((t) => t.id)).toEqual(["t3", "t2", "t1"]);
  });

  it("nulls in someday sort by deadline (only nulls land here)", () => {
    const t1 = makeTask({ id: "t1", deadline: null, priority: null });
    const t2 = makeTask({ id: "t2", deadline: null, priority: "high" });
    const g = groupTasks([t1, t2], APR29);
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
