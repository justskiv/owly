import {
  DirectionFieldsSchema,
  ProjectFieldsSchema,
  TaskFieldsSchema,
} from "../schemas/entity";
import type { Entity } from "../schemas";
import { useEntityStore } from "../store/entities";
import type { ParsedQuickAdd } from "./quick-add-tokenizer";

export type QuickAddType = "task" | "project" | "direction";

export async function createFromQuickAdd(opts: {
  parsed: ParsedQuickAdd;
  type: QuickAddType;
  category: string;
}): Promise<Entity> {
  const { parsed, type, category } = opts;
  const base = {
    title: parsed.title,
    tags: [category],
    status: "active" as const,
    description: "",
    estimated_minutes: null,
    deadline: parsed.deadline,
  };

  const add = useEntityStore.getState().addEntity;

  switch (type) {
    case "task":
      return add({
        ...base,
        type: "task",
        priority: "medium",
        fields: TaskFieldsSchema.parse({ parent_project_id: null }),
      });
    case "project":
      return add({
        ...base,
        type: "project",
        priority: null,
        fields: ProjectFieldsSchema.parse({}),
      });
    case "direction":
      return add({
        ...base,
        type: "direction",
        priority: null,
        fields: DirectionFieldsSchema.parse({}),
      });
  }
}
