import { z } from "zod";
import { isoDate } from "./common";

export const HorizonSizeSchema = z.enum(["big", "mid", "small"]);
export type HorizonSize = z.infer<typeof HorizonSizeSchema>;

export const HorizonProjectStateSchema = z.object({
  project_id: z.string(),
  months: z.array(z.number().int().min(0).max(11)).default([]),
  size: HorizonSizeSchema.default("mid"),
  hidden: z.boolean().default(false),
});
export type HorizonProjectState = z.infer<typeof HorizonProjectStateSchema>;

export const HorizonFileSchema = z.object({
  version: z.literal(1),
  // Horizon anchor; visible columns are base..base+7 (8 months).
  base_month: isoDate(),
  projects: z.array(HorizonProjectStateSchema),
  group_collapsed: z
    .object({
      big: z.boolean().default(false),
      mid: z.boolean().default(false),
      small: z.boolean().default(false),
    })
    .default({ big: false, mid: false, small: false }),
  section_collapsed: z
    .object({
      active: z.boolean().default(false),
      someday: z.boolean().default(false),
      deferred: z.boolean().default(true),
    })
    .default({ active: false, someday: false, deferred: true }),
});
export type HorizonFile = z.infer<typeof HorizonFileSchema>;
