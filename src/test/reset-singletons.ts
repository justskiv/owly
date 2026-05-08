import { __resetDataDirCacheForTests } from "../services/file-io";
import { __resetSeedMigrationForTests } from "../services/seed-migration";
import { __resetCommandProcessorForTests } from "../services/command-processor";
import { __resetDashboardHotReloadForTests } from "../services/dashboard-hot-reload";
import { clearWeekCache } from "../services/week-cache";
import { invalidatePoolCache } from "../services/review-aggregations";

// Async because the listener resets need to await mockIPC's
// unregisterListener bridge — otherwise the next test's `listen()`
// can race a still-settling teardown and either drop the new handler
// or surface as an unhandled rejection.
export async function resetServiceSingletons(): Promise<void> {
  __resetDataDirCacheForTests();
  __resetSeedMigrationForTests();
  await __resetCommandProcessorForTests();
  await __resetDashboardHotReloadForTests();
  clearWeekCache();
  invalidatePoolCache();
}
