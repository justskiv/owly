import { EntitiesFileSchema } from "../schemas";
import {
  fileExists,
  getDataPath,
  readJsonFileOrCreate,
  writeJsonFile,
} from "./file-io";
import { EMPTY_ENTITIES_FILE } from "./defaults";
import { nowISO } from "./time-utils";

const MARKER = ".archive-migrated-v1";

// React.StrictMode mounts the boot effect twice in dev, so two parallel
// `maybeBackfillCompletedAt()` calls can race on the marker and the
// entities.json write. Module-level promise serialises them onto the
// same migration result — same pattern as `maybeMigrateToV2`.
let inflight: Promise<void> | null = null;

export function maybeBackfillCompletedAt(): Promise<void> {
  if (!inflight) inflight = run();
  return inflight;
}

// only for src/test/** — do not call from prod
export function __resetArchiveMigrationForTests(): void {
  inflight = null;
}

async function run(): Promise<void> {
  const markerPath = await getDataPath(MARKER);
  if (await fileExists(markerPath)) return;

  const entitiesPath = await getDataPath("entities.json");
  const file = await readJsonFileOrCreate(
    entitiesPath,
    EntitiesFileSchema,
    EMPTY_ENTITIES_FILE,
  );

  // Backfill `completed_at = updated_at` for any done entity that's
  // missing it. updated_at is the closest proxy we have on existing
  // data — for most users it matches the moment the checkbox was
  // ticked; for tasks edited after completion it can be off, but
  // that's a known trade-off (variant A in spec §4.3) and still beats
  // showing "date unknown" for every historical task.
  const next = file.entities.map((e) => {
    if (e.status !== "done") return e;
    if (e.completed_at !== null) return e;
    return { ...e, completed_at: e.updated_at };
  });

  await writeJsonFile(entitiesPath, { version: 1, entities: next });
  await writeJsonFile(markerPath, { at: nowISO() });
}
