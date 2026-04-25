import type { WeekFile } from "../schemas";
import { WeekFileSchema } from "../schemas";
import { fileExists, getDataPath, readJsonFile } from "./file-io";

// In-memory cache of parsed week files. Stats services
// (routine-stats, carry-over) used to re-read all 26 week files on
// every routine click and every block edit — at ~26 IPC calls per
// interaction this scales poorly. The cache holds parsed WeekFile
// objects keyed by weekId; mutations through the schedule store
// push the new shape back via setCachedWeek so the next stats query
// sees the latest blocks without touching disk.
//
// `null` means "verified missing" — distinct from "never asked".
// Without this distinction every cache miss would re-stat the file.

const cache = new Map<string, WeekFile | null>();

// In-flight reads de-dup: two simultaneous getCachedWeek calls for
// the same weekId share a single Tauri invoke. Resolved promises
// are removed once committed to `cache` so memory doesn't grow.
const inflight = new Map<string, Promise<WeekFile | null>>();

export async function getCachedWeek(
  weekId: string,
): Promise<WeekFile | null> {
  if (cache.has(weekId)) return cache.get(weekId) ?? null;
  const pending = inflight.get(weekId);
  if (pending) return pending;

  const promise = (async () => {
    const path = await getDataPath("schedule", `${weekId}.json`);
    if (!(await fileExists(path))) {
      cache.set(weekId, null);
      return null;
    }
    try {
      const file = await readJsonFile(path, WeekFileSchema);
      cache.set(weekId, file);
      return file;
    } catch (e) {
      // Corrupt files shouldn't poison the cache silently — surface
      // them in dev via console; the file-io recovery path will deal
      // with them on the next user-initiated load.
      console.warn(
        `[week-cache] skip ${weekId}: ${(e as Error).message}`,
      );
      cache.set(weekId, null);
      return null;
    }
  })();

  inflight.set(weekId, promise);
  try {
    return await promise;
  } finally {
    inflight.delete(weekId);
  }
}

// Called from the schedule store right after writeJsonFile succeeds
// (and from week-manager when it creates new files), so subsequent
// reads return the same shape that was just persisted.
export function setCachedWeek(weekId: string, file: WeekFile | null): void {
  cache.set(weekId, file);
}

// Drops the entry — next read will hit disk. Useful when an external
// process (or the user) edits a JSON file out-of-band.
export function invalidateCachedWeek(weekId: string): void {
  cache.delete(weekId);
}

export function clearWeekCache(): void {
  cache.clear();
  inflight.clear();
}
