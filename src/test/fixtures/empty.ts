import { WeekFileSchema } from "../../schemas/schedule";

export const emptyWeekId = "2026-w19";
export const emptyWeekStartDate = "2026-05-04";

export const emptyWeek = WeekFileSchema.parse({
  version: 1,
  week: emptyWeekId,
  start_date: emptyWeekStartDate,
  template_applied: null,
  blocks: [],
});
