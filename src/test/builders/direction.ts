import { EntitySchema, type DirectionEntity } from "../../schemas/entity";
import { nowISO } from "../../services/time-utils";

let counter = 0;

export function buildDirection(
  overrides: Partial<DirectionEntity> = {},
): DirectionEntity {
  return EntitySchema.parse({
    id: `direction-${++counter}`,
    type: "direction",
    title: "Direction",
    tags: ["work"],
    status: "active",
    priority: null,
    deadline: null,
    estimated_minutes: null,
    description: "",
    created_at: nowISO(),
    updated_at: nowISO(),
    fields: {
      target: null,
      current: null,
      progress: null,
      cadence: null,
      last_act: null,
      cadence_label: null,
    },
    ...overrides,
  }) as DirectionEntity;
}

export function resetDirectionCounter(): void {
  counter = 0;
}
