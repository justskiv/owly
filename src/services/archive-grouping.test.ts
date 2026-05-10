import { describe, expect, it } from "vitest";
import type { TaskEntity } from "../schemas";
import { groupArchiveByMonth, formatGroupLabel } from "./archive-grouping";

function makeDone(
  overrides: Partial<TaskEntity> & { id: string; completed_at: string | null },
): TaskEntity {
  const base: TaskEntity = {
    type: "task",
    id: overrides.id,
    title: `Task ${overrides.id}`,
    tags: ["life"],
    status: "done",
    priority: "medium",
    deadline: null,
    estimated_minutes: null,
    description: "",
    created_at: "2026-01-01T00:00:00",
    updated_at: "2026-01-01T00:00:00",
    completed_at: overrides.completed_at,
    fields: { parent_project_id: null, checklist: [] },
  };
  return { ...base, ...overrides };
}

const NOW = new Date(2026, 4, 10); // 10 May 2026

describe("groupArchiveByMonth", () => {
  it("returns empty array for empty input", () => {
    expect(groupArchiveByMonth([], NOW)).toEqual([]);
  });

  it("groups tasks by year-month of completed_at", () => {
    const t1 = makeDone({ id: "t1", completed_at: "2026-05-08T10:00:00" });
    const t2 = makeDone({ id: "t2", completed_at: "2026-05-03T10:00:00" });
    const t3 = makeDone({ id: "t3", completed_at: "2026-04-28T10:00:00" });
    const groups = groupArchiveByMonth([t1, t2, t3], NOW);
    expect(groups).toHaveLength(2);
    expect(groups[0].key).toBe("2026-05");
    expect(groups[0].items.map((x) => x.id)).toEqual(["t1", "t2"]);
    expect(groups[1].key).toBe("2026-04");
    expect(groups[1].items.map((x) => x.id)).toEqual(["t3"]);
  });

  it("labels current month with 'этот месяц' suffix", () => {
    const t = makeDone({ id: "t", completed_at: "2026-05-08T10:00:00" });
    const [g] = groupArchiveByMonth([t], NOW);
    expect(g.label).toBe("Май 2026 · этот месяц");
  });

  it("labels previous month with 'прошлый месяц' suffix", () => {
    const t = makeDone({ id: "t", completed_at: "2026-04-15T10:00:00" });
    const [g] = groupArchiveByMonth([t], NOW);
    expect(g.label).toBe("Апрель 2026 · прошлый месяц");
  });

  it("labels other months in current year without suffix", () => {
    const t = makeDone({ id: "t", completed_at: "2026-02-15T10:00:00" });
    const [g] = groupArchiveByMonth([t], NOW);
    expect(g.label).toBe("Февраль 2026");
  });

  it("labels prior years with year explicit", () => {
    const t = makeDone({ id: "t", completed_at: "2025-12-15T10:00:00" });
    const [g] = groupArchiveByMonth([t], NOW);
    expect(g.label).toBe("Декабрь 2025");
  });

  it("January wraps prev-month detection to December of prior year", () => {
    const jan = new Date(2026, 0, 15);
    const t = makeDone({ id: "t", completed_at: "2025-12-20T10:00:00" });
    const [g] = groupArchiveByMonth([t], jan);
    expect(g.label).toBe("Декабрь 2025 · прошлый месяц");
  });

  it("buckets null completed_at into 'unknown' group at the end", () => {
    const t1 = makeDone({ id: "t1", completed_at: "2026-05-08T10:00:00" });
    const t2 = makeDone({ id: "t2", completed_at: null });
    const groups = groupArchiveByMonth([t1, t2], NOW);
    expect(groups).toHaveLength(2);
    expect(groups[1].key).toBe("unknown");
    expect(groups[1].label).toBe("Дата завершения неизвестна");
    expect(groups[1].items.map((x) => x.id)).toEqual(["t2"]);
  });

  it("preserves caller-provided order within and across groups", () => {
    const t1 = makeDone({ id: "t1", completed_at: "2026-05-01T10:00:00" });
    const t2 = makeDone({ id: "t2", completed_at: "2026-04-30T10:00:00" });
    const t3 = makeDone({ id: "t3", completed_at: "2026-05-09T10:00:00" });
    const groups = groupArchiveByMonth([t1, t2, t3], NOW);
    expect(groups[0].key).toBe("2026-05");
    expect(groups[0].items.map((x) => x.id)).toEqual(["t1", "t3"]);
    expect(groups[1].items.map((x) => x.id)).toEqual(["t2"]);
  });
});

describe("formatGroupLabel", () => {
  it("uses MONTH_NAMES_RU month name + year", () => {
    expect(formatGroupLabel(2025, 6, NOW)).toBe("Июль 2025");
  });
});
