import { BlockSchema, type Block } from "../../schemas/schedule";
import { formatDate } from "../../services/time-utils";
import { now } from "../../services/clock";

let counter = 0;

export function buildBlock(overrides: Partial<Block> = {}): Block {
  return BlockSchema.parse({
    id: `block-${++counter}`,
    title: "Block",
    date: formatDate(now()),
    start: "10:00",
    duration: 60,
    category: "work",
    source_entity_id: null,
    pool_item_id: null,
    status: "planned",
    notes: "",
    ...overrides,
  });
}

export function resetBlockCounter(): void {
  counter = 0;
}
