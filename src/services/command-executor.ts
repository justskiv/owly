import type { Block, Command, Entity, PoolItem } from "../schemas";
import { EntitySchema, PoolItemSchema } from "../schemas";
import {
  applyToWeek,
  findBlockById,
  findWeekContainingBlock,
} from "../store/schedule";
import { useEntityStore } from "../store/entities";
import { useHorizonStore } from "../store/horizon";
import { usePoolStore } from "../store/pool";
import {
  applyToPoolWeek,
  deletePoolItemCascade,
} from "./pool-actions";
import {
  createEmptyWeek,
  createWeekFromTemplate,
  weekFileExists,
} from "./week-manager";
import { now } from "./clock";
import { dateToWeekId, formatDate, generateId, nowISO } from "./time-utils";
import { errMsg } from "./format";

// Errors thrown from a sub-command inside batch carry these extras
// so the processor can record `partial: { succeeded, failed_at_index }`
// on the failed/ snapshot. Plain `Error` works for non-batch failures.
interface BatchPartialError extends Error {
  partialIndex: number;
  partialSucceeded: number;
}

function isBatchPartialError(e: unknown): e is BatchPartialError {
  return (
    e instanceof Error &&
    typeof (e as Partial<BatchPartialError>).partialIndex === "number"
  );
}

export function batchPartialOf(
  e: unknown,
): { succeeded: number; failed_at_index: number } | undefined {
  if (!isBatchPartialError(e)) return undefined;
  return { succeeded: e.partialSucceeded, failed_at_index: e.partialIndex };
}

// Execute one validated command. Throws on failure; the processor
// catches and routes to commands/failed/. For `batch`: each
// sub-command is already type-checked by the discriminated union;
// runs sequentially, the first throw aborts and propagates with
// the offending index annotated.
export async function executeCommand(cmd: Command): Promise<void> {
  switch (cmd.action) {
    case "create_block": {
      const block: Block = {
        id: generateId("blk"),
        title: cmd.data.title,
        date: cmd.data.date,
        start: cmd.data.start,
        duration: cmd.data.duration,
        category: cmd.data.category,
        source_entity_id: cmd.data.source_entity_id,
        pool_item_id: null,
        status: "planned",
        notes: cmd.data.notes ?? "",
      };
      await applyToWeek(dateToWeekId(cmd.data.date), (bs) => [...bs, block]);
      return;
    }

    case "update_block": {
      const { block_id, ...patch } = cmd.data;
      const weekId = await findWeekContainingBlock(block_id);
      if (!weekId) throw new Error(`Block ${block_id} not found`);
      await applyToWeek(weekId, (bs) =>
        bs.map((b) => (b.id === block_id ? { ...b, ...patch } : b)),
      );
      return;
    }

    case "move_block": {
      const { block_id, new_date, new_start } = cmd.data;
      const fromWeek = await findWeekContainingBlock(block_id);
      if (!fromWeek) throw new Error(`Block ${block_id} not found`);
      const toWeek = dateToWeekId(new_date);
      if (fromWeek === toWeek) {
        await applyToWeek(toWeek, (bs) =>
          bs.map((b) =>
            b.id === block_id ? { ...b, date: new_date, start: new_start } : b,
          ),
        );
        return;
      }
      // Cross-week: write destination FIRST, then remove from source.
      // If dest write fails → source untouched (no data loss). If
      // source-removal fails → block exists in both weeks (recoverable
      // via update_block / delete_block). Either way is better than
      // the reverse order, where dest-failure permanently lost a
      // block that source already deleted.
      const cur = await findBlockById(fromWeek, block_id);
      if (!cur) throw new Error(`Block ${block_id} vanished mid-move`);
      // Pool items are per-week. A cross-week move would orphan the
      // pool_item_id reference in the destination — null it so the
      // moved block becomes a plain ad-hoc block in the target week.
      const movedBlock: Block = {
        ...cur,
        date: new_date,
        start: new_start,
        pool_item_id: null,
      };
      // Idempotency: a retry from failed/ (e.g. earlier source-cleanup
      // throw with destination already written) would otherwise
      // duplicate the block. Skip the append if it's already there.
      await applyToWeek(toWeek, (bs) =>
        bs.some((b) => b.id === block_id) ? bs : [...bs, movedBlock],
      );
      try {
        await applyToWeek(fromWeek, (bs) =>
          bs.filter((b) => b.id !== block_id),
        );
      } catch (e) {
        throw new Error(
          `move_block: destination written but source cleanup failed — ` +
            `block ${block_id} now duplicated in ${fromWeek} and ${toWeek}: ` +
            `${errMsg(e)}`,
        );
      }
      return;
    }

    case "resize_block": {
      const { block_id, new_duration } = cmd.data;
      const weekId = await findWeekContainingBlock(block_id);
      if (!weekId) throw new Error(`Block ${block_id} not found`);
      await applyToWeek(weekId, (bs) =>
        bs.map((b) =>
          b.id === block_id ? { ...b, duration: new_duration } : b,
        ),
      );
      return;
    }

    case "delete_block": {
      const weekId = await findWeekContainingBlock(cmd.data.block_id);
      // Delete is idempotent: if the block is already gone, that's
      // success — the desired end state is reached.
      if (!weekId) return;
      await applyToWeek(weekId, (bs) =>
        bs.filter((b) => b.id !== cmd.data.block_id),
      );
      return;
    }

    case "set_block_status": {
      const { block_id, status } = cmd.data;
      const weekId = await findWeekContainingBlock(block_id);
      if (!weekId) throw new Error(`Block ${block_id} not found`);
      await applyToWeek(weekId, (bs) =>
        bs.map((b) => (b.id === block_id ? { ...b, status } : b)),
      );
      return;
    }

    case "create_entity": {
      // CommandSchema already validated cmd.data against EntitySchema,
      // so id/created_at/updated_at are present and well-formed.
      await useEntityStore.getState().addEntity(cmd.data);
      return;
    }

    case "update_entity": {
      const data = cmd.data as Record<string, unknown> & { entity_id: string };
      // Strip identity fields from the patch so a careless agent
      // can't morph a task into a contact, rewrite history, or
      // overwrite the canonical id. updated_at is always set fresh.
      const {
        entity_id,
        id: _ignoreId,
        type: _ignoreType,
        created_at: _ignoreCreated,
        updated_at: _ignoreUpdated,
        ...patch
      } = data;
      void _ignoreId;
      void _ignoreType;
      void _ignoreCreated;
      void _ignoreUpdated;
      const cur = useEntityStore
        .getState()
        .entities.find((e: Entity) => e.id === entity_id);
      if (!cur) throw new Error(`Entity ${entity_id} not found`);
      // Merge patch onto the current shape, then re-validate against
      // EntitySchema. This catches type drift in fields that
      // looseObject lets through (e.g. patching priority with a
      // number, or a contact-only field on a task).
      const merged = { ...cur, ...patch, updated_at: nowISO() };
      const parsed = EntitySchema.safeParse(merged);
      if (!parsed.success) {
        const issues = parsed.error.issues
          .map((i) => `${i.path.join(".")}: ${i.message}`)
          .join("; ");
        throw new Error(`update_entity rejected: ${issues}`);
      }
      await useEntityStore.getState().updateEntity(entity_id, parsed.data);
      return;
    }

    case "delete_entity": {
      const id = cmd.data.entity_id;
      await useEntityStore.getState().deleteEntity(id);
      // Active-week cascade: drop any blocks / pool items pointing
      // at this entity in the currently-loaded week. A full
      // cross-week sweep is Phase 3 (#1) — for now an agent-driven
      // delete doesn't leave dangling source_entity_id references
      // visible on the user's current grid. Other weeks may still
      // hold orphan references (acceptable per Phase 1 — the UI
      // tolerates orphan source_entity_id and shows the stored
      // block.title fallback).
      const activeWeek = usePoolStore.getState().currentWeek;
      await applyToWeek(activeWeek, (bs) =>
        bs.filter((b) => b.source_entity_id !== id),
      );
      await applyToPoolWeek(activeWeek, (items) =>
        items.filter((it) => it.source_entity_id !== id),
      );
      return;
    }

    case "create_week": {
      const { week, apply_template } = cmd.data;
      if (await weekFileExists(week)) {
        throw new Error(`Week ${week} already exists`);
      }
      if (apply_template) {
        await createWeekFromTemplate(week);
      } else {
        await createEmptyWeek(week);
      }
      return;
    }

    case "create_pool_item": {
      const { week, ...payload } = cmd.data;
      const now = nowISO();
      const item: PoolItem = {
        id: generateId("pool"),
        title: payload.title,
        hours: payload.hours,
        category: payload.category,
        splittable: payload.splittable,
        source_entity_id: payload.source_entity_id,
        source_kind: payload.source_kind,
        placed: false,
        created_at: now,
        updated_at: now,
      };
      await applyToPoolWeek(week, (items) => [...items, item]);
      return;
    }

    case "update_pool_item": {
      const data = cmd.data as Record<string, unknown> & {
        week: string;
        pool_item_id: string;
      };
      // Strip identity / timestamps from the patch so an agent can't
      // re-id an item, rewrite created_at, or change a splittable
      // into something else by accident. updated_at is set fresh.
      // Mirrors update_entity (line 165-181); without it loose-data
      // bypasses Zod and feeds the store invalid PoolItems.
      const {
        week,
        pool_item_id,
        id: _ignoreId,
        created_at: _ignoreCreated,
        updated_at: _ignoreUpdated,
        ...patch
      } = data;
      void _ignoreId;
      void _ignoreCreated;
      void _ignoreUpdated;
      let foundCount = 0;
      let validationError: string | null = null;
      await applyToPoolWeek(week, (items) =>
        items.map((it) => {
          if (it.id !== pool_item_id) return it;
          foundCount++;
          const merged = { ...it, ...patch, updated_at: nowISO() };
          const parsed = PoolItemSchema.safeParse(merged);
          if (!parsed.success) {
            validationError = parsed.error.issues
              .map((i) => `${i.path.join(".")}: ${i.message}`)
              .join("; ");
            return it;
          }
          return parsed.data;
        }),
      );
      if (validationError) {
        throw new Error(`update_pool_item rejected: ${validationError}`);
      }
      if (foundCount === 0) {
        throw new Error(
          `Pool item ${pool_item_id} not found in week ${week}`,
        );
      }
      return;
    }

    case "delete_pool_item": {
      const { week, pool_item_id } = cmd.data;
      await deletePoolItemCascade(week, pool_item_id);
      return;
    }

    case "set_horizon_months": {
      const { project_id, months } = cmd.data;
      const exists = useHorizonStore
        .getState()
        .projects.some((p) => p.project_id === project_id);
      if (!exists) {
        throw new Error(`Horizon project ${project_id} not found`);
      }
      await useHorizonStore.getState().setMonths(project_id, months);
      return;
    }

    case "set_horizon_hidden": {
      const { project_id, hidden } = cmd.data;
      const exists = useHorizonStore
        .getState()
        .projects.some((p) => p.project_id === project_id);
      if (!exists) {
        throw new Error(`Horizon project ${project_id} not found`);
      }
      await useHorizonStore.getState().setHidden(project_id, hidden);
      return;
    }

    case "set_horizon_size": {
      const { project_id, size } = cmd.data;
      const exists = useHorizonStore
        .getState()
        .projects.some((p) => p.project_id === project_id);
      if (!exists) {
        throw new Error(`Horizon project ${project_id} not found`);
      }
      await useHorizonStore.getState().setSize(project_id, size);
      return;
    }

    case "mark_cadence": {
      const { direction_id } = cmd.data;
      const cur = useEntityStore
        .getState()
        .entities.find((e: Entity) => e.id === direction_id);
      if (!cur) throw new Error(`Direction ${direction_id} not found`);
      if (cur.type !== "direction") {
        throw new Error(
          `Entity ${direction_id} is type ${cur.type}, not direction`,
        );
      }
      // Spread current fields — replacing `fields` outright would wipe
      // cadence / target / current / progress for any direction the
      // agent never set explicitly via mark_cadence. Re-validate the
      // merged entity (mirrors update_entity) so a hand-edited file
      // with type-drifted fields can't quietly persist.
      const merged = {
        ...cur,
        fields: { ...cur.fields, last_act: formatDate(now()) },
      };
      const parsed = EntitySchema.safeParse(merged);
      if (!parsed.success) {
        const issues = parsed.error.issues
          .map((i) => `${i.path.join(".")}: ${i.message}`)
          .join("; ");
        throw new Error(`mark_cadence rejected: ${issues}`);
      }
      // parsed.data is a discriminated Entity; updateEntity merges the
      // partial onto the current row, so passing the whole entity is
      // equivalent here (type/id/timestamps stay identical).
      await useEntityStore.getState().updateEntity(direction_id, parsed.data);
      return;
    }

    case "batch": {
      let i = 0;
      for (const sub of cmd.data.commands) {
        try {
          await executeCommand(sub as Command);
        } catch (e) {
          const msg = errMsg(e);
          const wrapped: BatchPartialError = Object.assign(
            new Error(`Sub-command #${i} (${sub.action}) failed: ${msg}`),
            { partialIndex: i, partialSucceeded: i },
          ) as BatchPartialError;
          throw wrapped;
        }
        i++;
      }
      return;
    }
  }
}
