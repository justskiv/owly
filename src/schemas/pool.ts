import { z } from "zod";
import { weekId } from "./common";

export const PoolItemSourceKindSchema = z.enum([
  "task",
  "project",
  "direction",
  "ad-hoc",
]);
export type PoolItemSourceKind = z.infer<typeof PoolItemSourceKindSchema>;

export const PoolItemSchema = z.object({
  id: z.string(),
  title: z.string(),
  hours: z.number().positive(),
  category: z.string(),
  splittable: z.boolean(),
  source_entity_id: z.string().nullable().default(null),
  source_kind: PoolItemSourceKindSchema.default("ad-hoc"),
  // Atomic items pin `placed` after their first drop on the grid.
  // Splittable items don't — their scheduled hours are derived from
  // grid blocks via recalcPool (Phase 6).
  placed: z.boolean().default(false),
  created_at: z.string(),
  updated_at: z.string(),
});
export type PoolItem = z.infer<typeof PoolItemSchema>;

export const PoolFileSchema = z.object({
  version: z.literal(1),
  week: weekId(),
  items: z.array(PoolItemSchema),
});
export type PoolFile = z.infer<typeof PoolFileSchema>;
