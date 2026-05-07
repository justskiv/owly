import { EntitySchema, type TaskEntity } from "../../schemas/entity";
import { nowISO } from "../../services/time-utils";

let counter = 0;

export function buildTask(
  overrides: Partial<TaskEntity> = {},
): TaskEntity {
  return EntitySchema.parse({
    id: `task-${++counter}`,
    type: "task",
    title: "Task",
    tags: ["work"],
    status: "active",
    priority: "medium",
    deadline: null,
    estimated_minutes: null,
    description: "",
    created_at: nowISO(),
    updated_at: nowISO(),
    fields: { parent_project_id: null, checklist: [] },
    ...overrides,
  }) as TaskEntity;
}

export function resetTaskCounter(): void {
  counter = 0;
}
