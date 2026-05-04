import { z } from "zod";
import { DayOfWeekSchema, timeHHMM } from "./common";

export const TemplateBlockSchema = z.object({
  day: DayOfWeekSchema,
  start: timeHHMM(),
  // Aligned with BlockSchema.duration: the template materialises into
  // weekly blocks via createWeekFromTemplate, so anything < 15 would
  // be rejected at the WeekFileSchema validation step.
  duration: z.number().int().min(15),
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
