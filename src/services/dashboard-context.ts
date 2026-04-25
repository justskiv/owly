import { DASHBOARD_WIDGETS } from "../components/dashboards/widgets";
import type { DashboardProps } from "./dashboard-compiler";

// Single place that bundles app data with the frozen widgets API for
// every dashboard render. Keeps the call site in DashboardHost slim.
export function buildDashboardProps(
  base: Omit<DashboardProps, "widgets">,
): DashboardProps {
  return { ...base, widgets: DASHBOARD_WIDGETS };
}
