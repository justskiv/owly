import { z } from "zod";

// Dashboard registry entry. Each entry points to a .jsx file in
// data/dashboards/ that the runtime compiles via sucrase + new
// Function. Files without a registry entry are not auto-discovered —
// the registry is the source of truth for ordering and visibility.
export const DashboardEntrySchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  // Lowercase letters, digits, underscore, dash; .jsx extension.
  // Tighter than fs would allow — keeps generated ids URL-safe.
  file: z
    .string()
    .regex(
      /^[a-z0-9_\-]+\.jsx$/,
      "filename must be lowercase alphanumeric with .jsx extension",
    ),
  // Either a Lucide icon name (e.g. "bar-chart") or an emoji.
  icon: z.string().default("bar-chart"),
  order: z.number().int().nonnegative(),
  description: z.string().default(""),
});

export const DashboardRegistrySchema = z.object({
  version: z.literal(1),
  dashboards: z.array(DashboardEntrySchema),
});

export type DashboardEntry = z.infer<typeof DashboardEntrySchema>;
export type DashboardRegistry = z.infer<typeof DashboardRegistrySchema>;
