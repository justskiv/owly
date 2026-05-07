import { __resetDataDirCacheForTests } from "../services/file-io";
import { __resetSeedMigrationForTests } from "../services/seed-migration";
import { __resetCommandProcessorForTests } from "../services/command-processor";
import { __resetDashboardHotReloadForTests } from "../services/dashboard-hot-reload";
import { clearWeekCache } from "../services/week-cache";
import { invalidatePoolCache } from "../services/review-aggregations";

export function resetServiceSingletons(): void {
  __resetDataDirCacheForTests();
  __resetSeedMigrationForTests();
  __resetCommandProcessorForTests();
  __resetDashboardHotReloadForTests();
  clearWeekCache();
  invalidatePoolCache();
}
