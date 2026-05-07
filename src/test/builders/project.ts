import { EntitySchema, type ProjectEntity } from "../../schemas/entity";
import { nowISO } from "../../services/time-utils";

let counter = 0;

export function buildProject(
  overrides: Partial<ProjectEntity> = {},
): ProjectEntity {
  return EntitySchema.parse({
    id: `project-${++counter}`,
    type: "project",
    title: "Project",
    tags: ["work"],
    status: "active",
    priority: "medium",
    deadline: null,
    estimated_minutes: null,
    description: "",
    created_at: nowISO(),
    updated_at: nowISO(),
    fields: {
      description: "",
      pipeline_stage: "research",
      task_ids: [],
      direction_id: null,
      board_id: "brd3",
      column_index: 0,
      last_activity_days: 0,
    },
    ...overrides,
  }) as ProjectEntity;
}

export function resetProjectCounter(): void {
  counter = 0;
}
