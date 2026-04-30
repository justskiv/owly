import { describe, expect, it } from "vitest";
import type { ProjectEntity, TaskEntity } from "../schemas";
import {
  applyProjectFilters,
  projectsForBoard,
  projectsForColumn,
} from "./projects-helpers";

function makeProject(
  overrides: Omit<Partial<ProjectEntity>, "fields"> & {
    id: string;
    fields?: Partial<ProjectEntity["fields"]>;
  },
): ProjectEntity {
  const base: ProjectEntity = {
    type: "project",
    id: overrides.id,
    title: `Project ${overrides.id}`,
    tags: ["work"],
    status: "active",
    priority: null,
    deadline: null,
    estimated_minutes: null,
    description: "",
    created_at: "2026-04-01T00:00:00",
    updated_at: "2026-04-01T00:00:00",
    fields: {
      description: "",
      pipeline_stage: "research",
      task_ids: [],
      direction_id: null,
      board_id: "brd1",
      column_index: 0,
      last_activity_days: 0,
    },
  };
  return {
    ...base,
    ...overrides,
    fields: { ...base.fields, ...(overrides.fields ?? {}) },
  };
}

function makeTask(id: string): TaskEntity {
  return {
    type: "task",
    id,
    title: `Task ${id}`,
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
}

describe("projectsForBoard", () => {
  it("returns only active projects on the requested board", () => {
    const p1 = makeProject({ id: "p1", fields: { board_id: "brd1" } });
    const p2 = makeProject({ id: "p2", fields: { board_id: "brd2" } });
    const p3 = makeProject({
      id: "p3",
      status: "archived",
      fields: { board_id: "brd1" },
    });
    const t = makeTask("t1");
    const r = projectsForBoard([p1, p2, p3, t], "brd1");
    expect(r.map((p) => p.id)).toEqual(["p1"]);
  });

  it("ignores tasks and other entity types", () => {
    const t = makeTask("t1");
    expect(projectsForBoard([t], "brd1")).toEqual([]);
  });
});

describe("applyProjectFilters", () => {
  const a = makeProject({
    id: "a",
    tags: ["work"],
    fields: { last_activity_days: 5 },
  });
  const b = makeProject({
    id: "b",
    tags: ["life"],
    fields: { last_activity_days: 20 },
  });
  const c = makeProject({
    id: "c",
    tags: ["work"],
    fields: { last_activity_days: 30 },
  });

  it("passthrough when both filters off", () => {
    expect(applyProjectFilters([a, b, c], null, false).map((p) => p.id))
      .toEqual(["a", "b", "c"]);
  });

  it("cat filter only", () => {
    expect(applyProjectFilters([a, b, c], "work", false).map((p) => p.id))
      .toEqual(["a", "c"]);
  });

  it("stale filter only (la >= 14)", () => {
    expect(applyProjectFilters([a, b, c], null, true).map((p) => p.id))
      .toEqual(["b", "c"]);
  });

  it("cat + stale composes as AND", () => {
    expect(applyProjectFilters([a, b, c], "work", true).map((p) => p.id))
      .toEqual(["c"]);
  });
});

describe("projectsForColumn", () => {
  const p0 = makeProject({ id: "p0", fields: { column_index: 0 } });
  const p2 = makeProject({ id: "p2", fields: { column_index: 2 } });
  const pLast = makeProject({ id: "pLast", fields: { column_index: 4 } });
  // Out-of-bounds for brd1 (5 columns: indexes 0..4).
  const pOob = makeProject({ id: "pOob", fields: { column_index: 99 } });

  it("matches exact column for non-last columns", () => {
    expect(projectsForColumn([p0, p2], "brd1", 0).map((p) => p.id))
      .toEqual(["p0"]);
    expect(projectsForColumn([p0, p2], "brd1", 2).map((p) => p.id))
      .toEqual(["p2"]);
  });

  it("buckets out-of-bounds projects into the last column", () => {
    const r = projectsForColumn([p0, p2, pLast, pOob], "brd1", 4);
    expect(r.map((p) => p.id).sort()).toEqual(["pLast", "pOob"]);
  });

  it("returns empty for unknown board", () => {
    expect(projectsForColumn([p0], "nope", 0)).toEqual([]);
  });
});
