import { create } from "zustand";
import type { Block, EntitiesFile, Entity, EntityType } from "../schemas";
import { EntitiesFileSchema } from "../schemas";

// Types shown in the Task Pool. Contacts/goals/notes/metrics live in
// the Entities page, not on the weekly grid.
const POOL_TYPES = new Set<EntityType>([
  "task",
  "project",
  "event",
  "routine",
]);
import {
  getDataPath,
  readJsonFileOrCreate,
  writeJsonFile,
} from "../services/file-io";
import { EMPTY_ENTITIES_FILE } from "../services/defaults";
import { generateId, nowISO } from "../services/time-utils";
import { trackSave } from "../services/save-status";
import { useConfigStore } from "./config";

type EntityDraft = Omit<Entity, "id" | "created_at" | "updated_at">;

// Persist-first: see schedule.ts for the same rationale.
async function persistEntities(entities: Entity[]) {
  const path = await getDataPath("entities.json");
  const file: EntitiesFile = { version: 1, entities };
  await writeJsonFile(path, file);
}

interface EntityStore {
  entities: Entity[];
  loading: boolean;
  error: string | null;

  loadEntities: () => Promise<void>;
  saveEntities: () => Promise<void>;

  addEntity: (draft: EntityDraft) => Promise<Entity>;
  updateEntity: (id: string, updates: Partial<Entity>) => Promise<void>;
  deleteEntity: (id: string) => Promise<void>;

  getByType: (type: EntityType) => Entity[];
  getByTag: (tag: string) => Entity[];
  getByTags: (tags: string[]) => Entity[];
  getUnscheduled: (weekBlocks: Block[]) => Entity[];
}

export const useEntityStore = create<EntityStore>((set, get) => ({
  entities: [],
  loading: false,
  error: null,

  loadEntities: async () => {
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
      const areas = useConfigStore.getState().config?.areas;
      if (areas) {
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
      set({ error: (e as Error).message, loading: false });
      throw e;
    }
  },

  saveEntities: async () => {
    await trackSave(() => persistEntities(get().entities));
  },

  addEntity: async (draft) => {
    const now = nowISO();
    const entity = {
      ...draft,
      id: generateId("ent"),
      created_at: now,
      updated_at: now,
    } as Entity;
    const next = [...get().entities, entity];
    await trackSave(() => persistEntities(next));
    set({ entities: next });
    return entity;
  },

  updateEntity: async (id, updates) => {
    const next = get().entities.map((e) =>
      e.id === id
        ? ({ ...e, ...updates, updated_at: nowISO() } as Entity)
        : e,
    );
    await trackSave(() => persistEntities(next));
    set({ entities: next });
  },

  deleteEntity: async (id) => {
    const next = get().entities.filter((e) => e.id !== id);
    await trackSave(() => persistEntities(next));
    set({ entities: next });
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
