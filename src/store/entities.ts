import { create } from "zustand";
import type { Block, EntitiesFile, Entity, EntityType } from "../schemas";
import { EntitiesFileSchema } from "../schemas";
import {
  getDataPath,
  readJsonFileOrCreate,
  writeJsonFile,
} from "../services/file-io";
import { EMPTY_ENTITIES_FILE } from "../services/defaults";
import { generateId, nowISO } from "../services/time-utils";
import { trackSave } from "../services/save-status";

type EntityDraft = Omit<Entity, "id" | "created_at" | "updated_at">;

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
      set({ entities: file.entities, loading: false });
    } catch (e) {
      set({ error: (e as Error).message, loading: false });
      throw e;
    }
  },

  saveEntities: async () => {
    await trackSave(async () => {
      const path = await getDataPath("entities.json");
      const file: EntitiesFile = { version: 1, entities: get().entities };
      await writeJsonFile(path, file);
    });
  },

  addEntity: async (draft) => {
    const now = nowISO();
    const entity = {
      ...draft,
      id: generateId("ent"),
      created_at: now,
      updated_at: now,
    } as Entity;
    set({ entities: [...get().entities, entity] });
    await get().saveEntities();
    return entity;
  },

  updateEntity: async (id, updates) => {
    set({
      entities: get().entities.map((e) =>
        e.id === id
          ? ({ ...e, ...updates, updated_at: nowISO() } as Entity)
          : e,
      ),
    });
    await get().saveEntities();
  },

  deleteEntity: async (id) => {
    set({ entities: get().entities.filter((e) => e.id !== id) });
    await get().saveEntities();
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
      (e) => !scheduledIds.has(e.id) && e.status === "active",
    );
  },
}));
