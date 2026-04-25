import type { Block, Command, Entity } from "../schemas";
import { EntitySchema } from "../schemas";
import { applyToWeek, findWeekContainingBlock } from "../store/schedule";
import { useEntityStore } from "../store/entities";
import {
  createEmptyWeek,
  createWeekFromTemplate,
  weekFileExists,
} from "./week-manager";
import { dateToWeekId, generateId, nowISO } from "./time-utils";

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
      // Cross-week: pull from source, then push to destination.
      let moved: Block | null = null;
      await applyToWeek(fromWeek, (bs) => {
        const next: Block[] = [];
        for (const b of bs) {
          if (b.id === block_id) moved = b;
          else next.push(b);
        }
        return next;
      });
      if (!moved) throw new Error(`Block ${block_id} vanished mid-move`);
      const movedBlock: Block = {
        ...(moved as Block),
        date: new_date,
        start: new_start,
      };
      await applyToWeek(toWeek, (bs) => [...bs, movedBlock]);
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
      const { entity_id, ...patch } = data;
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
      await useEntityStore.getState().deleteEntity(cmd.data.entity_id);
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

    case "apply_template": {
      // Deferred. create_week with apply_template covers the common
      // case (start a week from a template); applying a template
      // onto an existing populated week needs a merge strategy
      // that we haven't decided on yet.
      throw new Error(
        "apply_template not implemented; use create_week with apply_template",
      );
    }

    case "batch": {
      let i = 0;
      for (const sub of cmd.data.commands) {
        try {
          await executeCommand(sub as Command);
        } catch (e) {
          const msg = (e as Error).message;
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
