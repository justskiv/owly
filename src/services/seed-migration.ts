import {
  ConfigFileSchema,
  EntitiesFileSchema,
  HorizonFileSchema,
  PoolFileSchema,
  WeekFileSchema,
} from "../schemas";
import type { z } from "zod";
import {
  ensureDir,
  fileExists,
  getDataPath,
  readJsonFile,
  readTextFile,
  writeJsonFile,
  writeTextFile,
  JsonReadError,
} from "./file-io";
import { generateId } from "./time-utils";

// Each seed file must validate against the corresponding schema after
// `@key` substitution but BEFORE we touch disk. A schema drift between
// the bundled seed and the current code (e.g., a new required field
// added to ProjectFieldsSchema without bumping seed) would otherwise
// write data the next loadConfig/loadEntities cannot parse, and the
// migration marker would still be written — a one-shot bricking.
const SEED_SCHEMAS: Record<string, z.ZodTypeAny> = {
  "schedule/2026-w18.json": WeekFileSchema,
  "pool/2026-w18.json": PoolFileSchema,
  "horizon.json": HorizonFileSchema,
  "entities.json": EntitiesFileSchema,
};

const REQUIRED_AREAS = ["work", "growth", "life", "people", "health"] as const;

// entities.json is intentionally LAST so that a partial-write failure
// leaves entities.json absent — the next launch then sees an empty
// state and retries the entire copy. If entities.json were first, a
// failure on file 2/3/4 would strand the user with non-empty entities
// + missing pool/horizon, and `isEntitiesFileEmpty` would return false
// next time → seed copy skipped → marker written → permanent half-state.
const SEED_FILES = [
  "schedule/2026-w18.json",
  "pool/2026-w18.json",
  "horizon.json",
  "entities.json",
] as const;

const KEY_REGEX = /"@([a-zA-Z0-9_-]+)"/g;

// React.StrictMode mounts the boot effect twice in dev, which can
// trigger two parallel `maybeMigrateToV2()` calls. Without a singleton
// guard, both pass the marker check, both generate their own
// `@key → UUID` map, and concurrent writes interleave entities.json
// from one run with schedule/pool/horizon from the other — every
// cross-reference dangles. Module-level promise serialises both
// callers onto the same migration result.
let inflight: Promise<void> | null = null;

export function maybeMigrateToV2(): Promise<void> {
  if (!inflight) inflight = runMigration();
  return inflight;
}

type EntitiesState = "missing" | "empty" | "populated" | "invalid";

async function runMigration(): Promise<void> {
  const markerPath = await getDataPath(".v2-migrated");
  if (await fileExists(markerPath)) return;

  // Probe entities.json first. We treat "invalid" as a HARD STOP —
  // overwriting a Zod-failing or syntactically-broken user file with
  // seed data would silently destroy real work. The legitimate
  // recovery path goes through readJsonFileOrCreate (which makes a
  // .corrupted-* backup); seed migration must not bypass it.
  const entitiesPath = await getDataPath("entities.json");
  const state = await probeEntities(entitiesPath);

  if (state === "invalid") {
    throw new Error(
      `Seed migration v2: ${entitiesPath} is invalid. ` +
        `Fix or remove the file and restart. The migration will not ` +
        `overwrite a non-empty file it could not parse.`,
    );
  }

  if (state === "missing" || state === "empty") {
    // Areas are only required when we are about to copy seed. If the
    // user already has data (state === "populated"), they keep their
    // own area set even if it doesn't match seed expectations — they
    // never see seed in this case.
    const cfgPath = await getDataPath("config.json");
    let cfg: { areas: { id: string }[] } | null = null;
    try {
      cfg = await readJsonFile(cfgPath, ConfigFileSchema);
    } catch (e) {
      if (!(e instanceof JsonReadError)) throw e;
      cfg = null;
    }

    if (cfg) {
      const have = new Set(cfg.areas.map((a) => a.id));
      const missing = REQUIRED_AREAS.filter((id) => !have.has(id));
      if (missing.length > 0) {
        throw new Error(
          `Seed migration v2 needs areas: ${missing.join(", ")}. ` +
            `Add them via Settings → Areas first.`,
        );
      }
    }

    const seedRoot = await getDataPath("seed-v2");
    if (await fileExists(seedRoot)) {
      await copySeedToData(seedRoot);
    }
    // If seed-v2 is missing (production bundle — fixed in Phase 9),
    // silently skip the copy. Marker is still written below.
  }

  await writeJsonFile(markerPath, { at: new Date().toISOString() });
}

async function probeEntities(path: string): Promise<EntitiesState> {
  if (!(await fileExists(path))) return "missing";
  try {
    const data = await readJsonFile(path, EntitiesFileSchema);
    return data.entities.length === 0 ? "empty" : "populated";
  } catch {
    return "invalid";
  }
}

// Picks a stable ID prefix from the seed `@key` so debug greppability
// matches existing conventions: @b* → blk, @p* (pool item) → pool,
// everything else (@pr*, @dir-*, @t*) → ent.
function pickPrefixFor(key: string): string {
  if (/^b\d+$/.test(key)) return "blk";
  if (/^p\d+$/.test(key)) return "pool";
  return "ent";
}

// Copies all seed files into data/, swapping `@key` placeholders for
// freshly-generated UUIDs (so seed IDs never collide with future
// user/AI writes). The same key in different files resolves to the
// same UUID, so cross-references (project_id in a pool item,
// direction_id in a project, etc.) survive the rewrite.
async function copySeedToData(seedRoot: string): Promise<void> {
  const dataRoot = await getDataPath("");

  // Step 1. Read every seed file as raw text and build a global
  // `@key → UUID` map.
  const rawTexts: Record<string, string> = {};
  const keyMap = new Map<string, string>();

  for (const f of SEED_FILES) {
    const seedPath = `${seedRoot}/${f}`;
    if (!(await fileExists(seedPath))) continue;
    const text = await readTextFile(seedPath);
    rawTexts[f] = text;
    for (const m of text.matchAll(KEY_REGEX)) {
      const key = m[1];
      if (!keyMap.has(key)) {
        keyMap.set(key, generateId(pickPrefixFor(key)));
      }
    }
  }

  // Step 2. Apply the map to every text and write into data/. Order
  // is defined by SEED_FILES — entities.json is last so that a partial
  // failure leaves it absent, allowing a retry on the next launch.
  // Each replaced text is validated against its schema BEFORE write;
  // any rejection aborts the whole migration before the marker is
  // written, so the user can fix the seed bundle and retry.
  for (const f of SEED_FILES) {
    const text = rawTexts[f];
    if (text === undefined) continue;
    const replaced = text.replace(KEY_REGEX, (_, key: string) => {
      const uuid = keyMap.get(key);
      return uuid ? `"${uuid}"` : `"@${key}"`;
    });
    const schema = SEED_SCHEMAS[f];
    if (schema) {
      let parsedJson: unknown;
      try {
        parsedJson = JSON.parse(replaced);
      } catch (e) {
        throw new Error(
          `Seed migration v2: ${f} is not valid JSON after key ` +
            `substitution: ${(e as Error).message}`,
        );
      }
      const result = schema.safeParse(parsedJson);
      if (!result.success) {
        const issues = result.error.issues
          .map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`)
          .join("; ");
        throw new Error(
          `Seed migration v2: ${f} rejected by schema: ${issues}`,
        );
      }
    }
    const targetPath = `${dataRoot}/${f}`;
    const slashIdx = targetPath.lastIndexOf("/");
    if (slashIdx > 0) {
      await ensureDir(targetPath.slice(0, slashIdx));
    }
    await writeTextFile(targetPath, replaced);
  }
}
