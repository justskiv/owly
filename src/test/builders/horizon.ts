import {
  HorizonProjectStateSchema,
  type HorizonProjectState,
} from "../../schemas/horizon";

let counter = 0;

export function buildHorizonProject(
  overrides: Partial<HorizonProjectState> = {},
): HorizonProjectState {
  return HorizonProjectStateSchema.parse({
    project_id: `project-${++counter}`,
    months: [],
    size: "mid",
    hidden: false,
    ...overrides,
  });
}

export function resetHorizonCounter(): void {
  counter = 0;
}
