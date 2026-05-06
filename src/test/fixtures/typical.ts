import { BlockSchema, WeekFileSchema } from "../../schemas/schedule";

export const typicalWeekId = "2026-w19";
export const typicalWeekStartDate = "2026-05-04";

export const typicalBlocks = [
  BlockSchema.parse({
    id: "blk-1",
    title: "Morning workout",
    date: "2026-05-04",
    start: "07:30",
    duration: 60,
    category: "health",
    source_entity_id: null,
    pool_item_id: null,
    status: "planned",
    notes: "",
  }),
  BlockSchema.parse({
    id: "blk-2",
    title: "Deep work",
    date: "2026-05-05",
    start: "10:00",
    duration: 120,
    category: "work",
    source_entity_id: null,
    pool_item_id: null,
    status: "done",
    notes: "",
  }),
  BlockSchema.parse({
    id: "blk-3",
    title: "Review",
    date: "2026-05-06",
    start: "17:00",
    duration: 30,
    category: "work",
    source_entity_id: null,
    pool_item_id: null,
    status: "planned",
    notes: "",
  }),
];

export const typicalWeek = WeekFileSchema.parse({
  version: 1,
  week: typicalWeekId,
  start_date: typicalWeekStartDate,
  template_applied: null,
  blocks: typicalBlocks,
});
