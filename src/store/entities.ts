import { create } from "zustand";
import type {
  Area,
  Block,
  EntitiesFile,
  Entity,
  EntityType,
} from "../schemas";
import { EntitiesFileSchema } from "../schemas";
import {
  getDataPath,
  readJsonFileOrCreate,
  writeJsonFile,
} from "../services/file-io";
import { EMPTY_ENTITIES_FILE } from "../services/defaults";
import { generateId, nowISO } from "../services/time-utils";
import { trackSave } from "../services/save-status";
import { enqueueEntitiesWrite } from "../services/entities-write-queue";
import { errMsg } from "../services/format";

// Types shown in the Task Pool. Contacts/goals/notes/metrics live in
// the Entities page, not on the weekly grid.
const POOL_TYPES = new Set<EntityType>([
  "task",
  "project",
  "event",
  "routine",
]);

type EntityDraft = Omit<
  Entity,
  "id" | "created_at" | "updated_at" | "completed_at"
> & {
  // Optional overrides used by the command executor — agent-supplied
  // commands carry their own id/timestamps. UI callers pass nothing
  // and the store fills them in.
  id?: string;
  created_at?: string;
  updated_at?: string;
  completed_at?: string | null;
};

// Persist-first: see schedule.ts for the same rationale.
// Validates before write — any call path that drifts from the schema
// surfaces as a throw instead of a silently corrupt file that would
// later be wiped by the corrupt-recovery path in readJsonFileOrCreate.
async function persistEntities(entities: Entity[]) {
  const path = await getDataPath("entities.json");
  const file: EntitiesFile = { version: 1, entities };
  const parsed = EntitiesFileSchema.safeParse(file);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`)
      .join("; ");
    throw new Error(`entities.json save rejected: ${issues}`);
  }
  await writeJsonFile(path, parsed.data);
}

interface EntityStore {
  entities: Entity[];
  loading: boolean;
  error: string | null;

  // `areas` is optional metadata used for unknown-tag warnings only.
  // Pass it from the caller (App.tsx, after loadConfig) to avoid an
  // implicit cross-store import here.
  loadEntities: (areas?: readonly Area[]) => Promise<void>;
  saveEntities: () => Promise<void>;

  addEntity: (draft: EntityDraft) => Promise<Entity>;
  updateEntity: (id: string, updates: Partial<Entity>) => Promise<void>;
  deleteEntity: (id: string) => Promise<void>;
  deleteDirectionWithCascade: (directionId: string) => Promise<void>;

  getByType: (type: EntityType) => Entity[];
  getByTag: (tag: string) => Entity[];
  getByTags: (tags: string[]) => Entity[];
  getUnscheduled: (weekBlocks: Block[]) => Entity[];
}

export const useEntityStore = create<EntityStore>((set, get) => ({
  entities: [],
  loading: false,
  error: null,

  loadEntities: async (areas) => {
    set({ loading: true, error: null });
    try {
      const path = await getDataPath("entities.json");
      const file = await readJsonFileOrCreate(
        path,
        EntitiesFileSchema,
        EMPTY_ENTITIES_FILE,
      );
      // Soft validation: flag tags that aren't in config.areas. We
      // don't drop or rewrite — the user might be migrating a config
      // and seeing their own labels is more useful than silent data.
      if (areas && areas.length > 0) {
        const known = new Set(areas.map((a) => a.id));
        for (const e of file.entities) {
          const unknown = e.tags.filter((t) => !known.has(t));
          if (unknown.length) {
            console.warn(
              `[entities] ${e.id} (${e.title}) has unknown tags:`,
              unknown,
            );
          }
        }
      }
      set({ entities: file.entities, loading: false });
    } catch (e) {
      set({ error: errMsg(e), loading: false });
      throw e;
    }
  },

  saveEntities: async () => {
    await trackSave(() =>
      enqueueEntitiesWrite(() => persistEntities(get().entities)),
    );
  },

  // In-memory set before disk write. persistEntities throws on a
  // rejected shape, leaving the in-memory set intact — downstream
  // toast surfaces the error and the next save retries the same state.
  // The previous await-first ordering let rapid consecutive calls
  // read stale `get()` snapshots and lose the intermediate update.
  addEntity: async (draft) => {
    const now = nowISO();
    const entity = {
      ...draft,
      id: draft.id ?? generateId("ent"),
      created_at: draft.created_at ?? now,
      updated_at: draft.updated_at ?? now,
      completed_at: draft.completed_at ?? null,
    } as Entity;
    const next = [...get().entities, entity];
    set({ entities: next });
    await trackSave(() =>
      enqueueEntitiesWrite(() => persistEntities(next)),
    );
    return entity;
  },

  updateEntity: async (id, updates) => {
    const next = get().entities.map((e) => {
      if (e.id !== id) return e;
      const merged = {
        ...e,
        ...updates,
        updated_at: nowISO(),
      } as Entity;
      // Stamp/clear completed_at on status transitions only — editing
      // title/priority of an already-done task must not bump the date,
      // otherwise the archive month grouping would drift.
      if ("status" in updates) {
        const wasDone = e.status === "done";
        const isDone = merged.status === "done";
        if (!wasDone && isDone) merged.completed_at = nowISO();
        else if (wasDone && !isDone) merged.completed_at = null;
      }
      return merged;
    });
    set({ entities: next });
    await trackSave(() =>
      enqueueEntitiesWrite(() => persistEntities(next)),
    );
  },

  deleteEntity: async (id) => {
    const next = get().entities.filter((e) => e.id !== id);
    set({ entities: next });
    await trackSave(() =>
      enqueueEntitiesWrite(() => persistEntities(next)),
    );
  },

  // Single-transaction cascade: rebuild the entities array in one
  // pass — clear `direction_id` on every linked project AND drop the
  // direction itself — then `set` once and `persistEntities` once.
  // Avoids the N+1 file writes and intermediate UI flicker the prior
  // sequential implementation produced.
  deleteDirectionWithCascade: async (directionId) => {
    const now = nowISO();
    const next = get()
      .entities.map((e) =>
        e.type === "project" && e.fields.direction_id === directionId
          ? ({
              ...e,
              fields: { ...e.fields, direction_id: null },
              updated_at: now,
            } as Entity)
          : e,
      )
      .filter((e) => e.id !== directionId);
    set({ entities: next });
    await trackSave(() =>
      enqueueEntitiesWrite(() => persistEntities(next)),
    );
  },

  getByType: (type) => get().entities.filter((e) => e.type === type),
  getByTag: (tag) => get().entities.filter((e) => e.tags.includes(tag)),
  getByTags: (tags) =>
    get().entities.filter((e) => e.tags.some((t) => tags.includes(t))),
  getUnscheduled: (weekBlocks) => {
    const scheduledIds = new Set(
      weekBlocks
        .map((b) => b.source_entity_id)
        .filter((id): id is string => id !== null),
    );
    return get().entities.filter(
      (e) =>
        !scheduledIds.has(e.id) &&
        e.status === "active" &&
        POOL_TYPES.has(e.type),
    );
  },
}));
