import { describe, expect, it } from "vitest";
import type { Area, Entity } from "../schemas";
import {
  CONTEXT_AREA_ORDER,
  directionsForArea,
  freshClass,
  projectsForDirection,
  sortAreasForContext,
  tooltipText,
} from "./context-helpers";

function makeArea(id: string): Area {
  return { id, label: id, color: "#000", icon: "" };
}

function makeDirection(
  id: string,
  tag: string,
  status: "active" | "archived" = "active",
): Entity {
  return {
    type: "direction",
    id,
    title: id,
    tags: [tag],
    status,
    priority: null,
    deadline: null,
    estimated_minutes: null,
    description: "",
    created_at: "2026-04-01T00:00:00",
    updated_at: "2026-04-01T00:00:00",
    completed_at: null,
    fields: {
      target: null,
      current: null,
      progress: null,
      cadence: null,
      last_act: null,
      cadence_label: null,
    },
  };
}

function makeProject(
  id: string,
  direction_id: string | null,
  status: "active" | "archived" = "active",
): Entity {
  return {
    type: "project",
    id,
    title: id,
    tags: ["work"],
    status,
    priority: null,
    deadline: null,
    estimated_minutes: null,
    description: "",
    created_at: "2026-04-01T00:00:00",
    updated_at: "2026-04-01T00:00:00",
    completed_at: null,
    fields: {
      description: "",
      pipeline_stage: "research",
      task_ids: [],
      board_id: "brd1",
      column_index: 0,
      direction_id,
      last_activity_days: 0,
    },
  };
}

describe("sortAreasForContext", () => {
  it("orders known areas by CONTEXT_AREA_ORDER", () => {
    const input = [
      makeArea("life"),
      makeArea("work"),
      makeArea("health"),
      makeArea("growth"),
      makeArea("people"),
    ];
    const out = sortAreasForContext(input).map((a) => a.id);
    expect(out).toEqual([...CONTEXT_AREA_ORDER]);
  });

  it("places unknown areas at the end", () => {
    const input = [
      makeArea("custom1"),
      makeArea("work"),
      makeArea("custom2"),
      makeArea("growth"),
    ];
    const out = sortAreasForContext(input).map((a) => a.id);
    expect(out.slice(0, 2)).toEqual(["work", "growth"]);
    expect(out.slice(2).sort()).toEqual(["custom1", "custom2"]);
  });

  it("does not mutate input", () => {
    const input = [makeArea("life"), makeArea("work")];
    const snapshot = input.map((a) => a.id);
    sortAreasForContext(input);
    expect(input.map((a) => a.id)).toEqual(snapshot);
  });
});

describe("directionsForArea", () => {
  it("filters by tag and active status", () => {
    const entities: Entity[] = [
      makeDirection("d1", "work"),
      makeDirection("d2", "work", "archived"),
      makeDirection("d3", "growth"),
      makeProject("p1", null),
    ];
    const out = directionsForArea(entities, "work").map((d) => d.id);
    expect(out).toEqual(["d1"]);
  });

  it("returns empty when no match", () => {
    const entities: Entity[] = [makeDirection("d1", "work")];
    expect(directionsForArea(entities, "people")).toEqual([]);
  });
});

describe("projectsForDirection", () => {
  it("filters projects by direction_id", () => {
    const entities: Entity[] = [
      makeProject("p1", "dir-yt"),
      makeProject("p2", "dir-yt", "archived"),
      makeProject("p3", "dir-habr"),
      makeProject("p4", null),
    ];
    const out = projectsForDirection(entities, "dir-yt").map((p) => p.id);
    expect(out).toEqual(["p1"]);
  });

  it("returns empty for unknown direction", () => {
    const entities: Entity[] = [makeProject("p1", "dir-yt")];
    expect(projectsForDirection(entities, "missing")).toEqual([]);
  });
});

describe("freshClass", () => {
  it("fresh for la <= 3", () => {
    expect(freshClass(0)).toBe("fresh");
    expect(freshClass(3)).toBe("fresh");
  });

  it("normal for 4..13", () => {
    expect(freshClass(4)).toBe("normal");
    expect(freshClass(13)).toBe("normal");
  });

  it("stale for la >= 14", () => {
    expect(freshClass(14)).toBe("stale");
    expect(freshClass(60)).toBe("stale");
  });
});

describe("tooltipText", () => {
  it("today for 0", () => {
    expect(tooltipText(0)).toBe("Активность сегодня");
  });

  it("yesterday for 1", () => {
    expect(tooltipText(1)).toBe("Вчера");
  });

  it("N days ago for >= 2", () => {
    expect(tooltipText(5)).toBe("Последняя активность 5 дн. назад");
    expect(tooltipText(30)).toBe("Последняя активность 30 дн. назад");
  });
});
