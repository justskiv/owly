import { z } from "zod";
import { DayOfWeekSchema, timeHHMM } from "./common";

export const TemplateBlockSchema = z.object({
  day: DayOfWeekSchema,
  start: timeHHMM(),
  duration: z.number().int().positive(),
  title: z.string(),
  category: z.string(),
});
export type TemplateBlock = z.infer<typeof TemplateBlockSchema>;

export const TemplateFileSchema = z.object({
  version: z.literal(1),
  name: z.string(),
  description: z.string(),
  blocks: z.array(TemplateBlockSchema),
});
export type TemplateFile = z.infer<typeof TemplateFileSchema>;
