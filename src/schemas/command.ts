import { z } from "zod";
import { isoDate, timeHHMM, weekId } from "./common";
import { BlockStatusSchema, BlockSchema } from "./schedule";
import { EntitySchema } from "./entity";

const baseCommandShape = {
  id: z.string(),
  timestamp: z.string(),
};

const blockUpdatableFields = BlockSchema.omit({ id: true }).partial();

export const CreateBlockCommandSchema = z.object({
  ...baseCommandShape,
  action: z.literal("create_block"),
  data: z.object({
    title: z.string(),
    date: isoDate(),
    start: timeHHMM(),
    duration: z.number().int().min(15),
    category: z.string(),
    source_entity_id: z.string().nullable(),
    notes: z.string().optional(),
  }),
});

export const UpdateBlockCommandSchema = z.object({
  ...baseCommandShape,
  action: z.literal("update_block"),
  data: z.object({
    block_id: z.string(),
    ...blockUpdatableFields.shape,
  }),
});

export const MoveBlockCommandSchema = z.object({
  ...baseCommandShape,
  action: z.literal("move_block"),
  data: z.object({
    block_id: z.string(),
    new_date: isoDate(),
    new_start: timeHHMM(),
  }),
});

export const ResizeBlockCommandSchema = z.object({
  ...baseCommandShape,
  action: z.literal("resize_block"),
  data: z.object({
    block_id: z.string(),
    new_duration: z.number().int().min(15),
  }),
});

export const DeleteBlockCommandSchema = z.object({
  ...baseCommandShape,
  action: z.literal("delete_block"),
  data: z.object({ block_id: z.string() }),
});

export const SetBlockStatusCommandSchema = z.object({
  ...baseCommandShape,
  action: z.literal("set_block_status"),
  data: z.object({
    block_id: z.string(),
    status: BlockStatusSchema,
  }),
});

export const CreateEntityCommandSchema = z.object({
  ...baseCommandShape,
  action: z.literal("create_entity"),
  data: EntitySchema,
});

export const UpdateEntityCommandSchema = z.object({
  ...baseCommandShape,
  action: z.literal("update_entity"),
  data: z.looseObject({
    entity_id: z.string(),
  }),
});

export const DeleteEntityCommandSchema = z.object({
  ...baseCommandShape,
  action: z.literal("delete_entity"),
  data: z.object({ entity_id: z.string() }),
});

export const CreateWeekCommandSchema = z.object({
  ...baseCommandShape,
  action: z.literal("create_week"),
  data: z.object({
    week: weekId(),
    apply_template: z.string().nullable(),
  }),
});

// `apply_template` (against an existing week) is not implemented yet.
// We deliberately omit it from the schema so the validation layer
// rejects it cleanly with a "Schema rejected" message — clearer
// than letting the executor accept-then-throw.

const SingleCommandSchema = z.discriminatedUnion("action", [
  CreateBlockCommandSchema,
  UpdateBlockCommandSchema,
  MoveBlockCommandSchema,
  ResizeBlockCommandSchema,
  DeleteBlockCommandSchema,
  SetBlockStatusCommandSchema,
  CreateEntityCommandSchema,
  UpdateEntityCommandSchema,
  DeleteEntityCommandSchema,
  CreateWeekCommandSchema,
]);

export const BatchCommandSchema = z.object({
  ...baseCommandShape,
  action: z.literal("batch"),
  data: z.object({
    commands: z.array(SingleCommandSchema),
  }),
});

export const CommandSchema = z.discriminatedUnion("action", [
  CreateBlockCommandSchema,
  UpdateBlockCommandSchema,
  MoveBlockCommandSchema,
  ResizeBlockCommandSchema,
  DeleteBlockCommandSchema,
  SetBlockStatusCommandSchema,
  CreateEntityCommandSchema,
  UpdateEntityCommandSchema,
  DeleteEntityCommandSchema,
  CreateWeekCommandSchema,
  BatchCommandSchema,
]);
export type Command = z.infer<typeof CommandSchema>;

// Snapshot written to commands/failed/<id>.json when execution
// fails. Loose because we want to preserve whatever the agent
// originally sent (even if malformed) so retry can re-emit it.
export const FailedCommandFileSchema = z.looseObject({
  id: z.string(),
  action: z.string(),
  timestamp: z.string().optional(),
  data: z.unknown().optional(),
  error: z.string(),
  failed_at: z.string(),
  // For batch: how many sub-commands ran before the failure.
  partial: z
    .object({
      succeeded: z.number().int().nonnegative(),
      failed_at_index: z.number().int().nonnegative(),
    })
    .optional(),
});
export type FailedCommandFile = z.infer<typeof FailedCommandFileSchema>;

// Done file is the original command verbatim — written by moving
// the pending file unchanged. Loose so the log can render even
// commands that the schema picked up after a CommandSchema bump.
export const DoneCommandFileSchema = z.looseObject({
  id: z.string(),
  action: z.string(),
  timestamp: z.string().optional(),
  data: z.unknown().optional(),
});
export type DoneCommandFile = z.infer<typeof DoneCommandFileSchema>;
