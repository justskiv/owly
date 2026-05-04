import { z } from "zod";
import { isoDate } from "./common";

export const HorizonSizeSchema = z.enum(["big", "mid", "small"]);
export type HorizonSize = z.infer<typeof HorizonSizeSchema>;

export const HorizonProjectStateSchema = z.object({
  project_id: z.string(),
  // Indices 0..11 (Jan..Dec). The visible board renders an 8-month
  // window (base..base+7), but the index space is the full year.
  // Unique refine: the renderer keys on month index, so a duplicate
  // would either swallow the second hit or render the same chip twice.
  months: z
    .array(z.number().int().min(0).max(11))
    .refine((arr) => new Set(arr).size === arr.length, {
      message: "months must be unique",
    })
    .default([]),
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
