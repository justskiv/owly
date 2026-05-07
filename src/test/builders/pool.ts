import { PoolItemSchema, type PoolItem } from "../../schemas/pool";
import { nowISO } from "../../services/time-utils";

let counter = 0;

export function buildPoolItem(
  overrides: Partial<PoolItem> = {},
): PoolItem {
  return PoolItemSchema.parse({
    id: `pool-${++counter}`,
    title: "Pool item",
    hours: 1,
    category: "work",
    splittable: false,
    source_entity_id: null,
    source_kind: "ad-hoc",
    placed: false,
    created_at: nowISO(),
    updated_at: nowISO(),
    ...overrides,
  });
}

export function resetPoolItemCounter(): void {
  counter = 0;
}
