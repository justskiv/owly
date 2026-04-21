import { z } from "zod";
import { isoDate, timeHHMM, weekId } from "./common";

export const BlockStatusSchema = z.enum([
  "planned",
  "done",
  "skipped",
  "moved",
]);
export type BlockStatus = z.infer<typeof BlockStatusSchema>;

export const BlockSchema = z.object({
  id: z.string(),
  title: z.string(),
  date: isoDate(),
  start: timeHHMM(),
  duration: z.number().int().min(15),
  category: z.string(),
  source_entity_id: z.string().nullable(),
  status: BlockStatusSchema,
  notes: z.string(),
});
export type Block = z.infer<typeof BlockSchema>;

export const WeekFileSchema = z.object({
  version: z.literal(1),
  week: weekId(),
  start_date: isoDate(),
  template_applied: z.string().nullable(),
  blocks: z.array(BlockSchema),
});
export type WeekFile = z.infer<typeof WeekFileSchema>;
