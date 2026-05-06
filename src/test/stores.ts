import { useScheduleStore } from "../store/schedule";
import { useEntityStore } from "../store/entities";
import { useConfigStore } from "../store/config";
import { useDashboardStore } from "../store/dashboards";
import { useCommandStore } from "../store/commands";
import { useUIStore } from "../store/ui";
import { useHorizonStore } from "../store/horizon";
import { usePoolStore } from "../store/pool";

const initial = {
  schedule: useScheduleStore.getState(),
  entity: useEntityStore.getState(),
  config: useConfigStore.getState(),
  dashboard: useDashboardStore.getState(),
  command: useCommandStore.getState(),
  ui: useUIStore.getState(),
  horizon: useHorizonStore.getState(),
  pool: usePoolStore.getState(),
};

export function resetAllStores(): void {
  useScheduleStore.setState(initial.schedule, true);
  useEntityStore.setState(initial.entity, true);
  useConfigStore.setState(initial.config, true);
  useDashboardStore.setState(initial.dashboard, true);
  useCommandStore.setState(initial.command, true);
  useUIStore.setState(initial.ui, true);
  useHorizonStore.setState(initial.horizon, true);
  usePoolStore.setState(initial.pool, true);
}
