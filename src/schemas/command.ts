import { z } from "zod";
import { isoDate, isoDateTime, timeHHMM, weekId } from "./common";
import { BlockStatusSchema, BlockSchema } from "./schedule";
import { EntitySchema } from "./entity";
import { HorizonSizeSchema } from "./horizon";

const baseCommandShape = {
  // Empty id slips past discriminated-union validation but breaks
  // markDone (which uses id for the done/<id>.json filename) — reject
  // here so the schema layer surfaces it as "Schema rejected" instead
  // of a confusing FS error mid-execute.
  id: z.string().min(1),
  // Strict format guards against ISO/TZ drift (toISOString() with `Z`
  // suffix, or accidental millisecond-precision strings) — see
  // common.ts for the canonical YYYY-MM-DDTHH:MM[:SS] shape.
  timestamp: isoDateTime(),
};

// `date` is intentionally excluded: a cross-week move belongs to the
// move_block command. update_block patches go to the source week
// only; letting `date` slip through here would silently strand the
// block in its original week file with a date pointing elsewhere.
const blockUpdatableFields = BlockSchema.omit({
  id: true,
  date: true,
}).partial();

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

export const CreatePoolItemCommandSchema = z.object({
  ...baseCommandShape,
  action: z.literal("create_pool_item"),
  data: z.object({
    week: weekId(),
    title: z.string(),
    hours: z.number().positive(),
    category: z.string(),
    splittable: z.boolean(),
    source_entity_id: z.string().nullable().default(null),
    source_kind: z
      .enum(["task", "project", "direction", "ad-hoc"])
      .default("ad-hoc"),
  }),
});

export const UpdatePoolItemCommandSchema = z.object({
  ...baseCommandShape,
  action: z.literal("update_pool_item"),
  data: z.looseObject({
    week: weekId(),
    pool_item_id: z.string(),
  }),
});

export const DeletePoolItemCommandSchema = z.object({
  ...baseCommandShape,
  action: z.literal("delete_pool_item"),
  data: z.object({
    week: weekId(),
    pool_item_id: z.string(),
  }),
});

export const SetHorizonMonthsCommandSchema = z.object({
  ...baseCommandShape,
  action: z.literal("set_horizon_months"),
  data: z.object({
    project_id: z.string(),
    // Mirrors HorizonProjectStateSchema.months: indices 0..11 (Jan..Dec),
    // unique. Duplicates are rejected because a project can't be in the
    // same month twice and the renderer keys on the index.
    months: z
      .array(z.number().int().min(0).max(11))
      .refine((arr) => new Set(arr).size === arr.length, {
        message: "months must be unique",
      }),
  }),
});

export const SetHorizonHiddenCommandSchema = z.object({
  ...baseCommandShape,
  action: z.literal("set_horizon_hidden"),
  data: z.object({
    project_id: z.string(),
    hidden: z.boolean(),
  }),
});

export const SetHorizonSizeCommandSchema = z.object({
  ...baseCommandShape,
  action: z.literal("set_horizon_size"),
  data: z.object({
    project_id: z.string(),
    size: HorizonSizeSchema,
  }),
});

export const MarkCadenceCommandSchema = z.object({
  ...baseCommandShape,
  action: z.literal("mark_cadence"),
  data: z.object({ direction_id: z.string() }),
});

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
  CreatePoolItemCommandSchema,
  UpdatePoolItemCommandSchema,
  DeletePoolItemCommandSchema,
  SetHorizonMonthsCommandSchema,
  SetHorizonHiddenCommandSchema,
  SetHorizonSizeCommandSchema,
  MarkCadenceCommandSchema,
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
  CreatePoolItemCommandSchema,
  UpdatePoolItemCommandSchema,
  DeletePoolItemCommandSchema,
  SetHorizonMonthsCommandSchema,
  SetHorizonHiddenCommandSchema,
  SetHorizonSizeCommandSchema,
  MarkCadenceCommandSchema,
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
