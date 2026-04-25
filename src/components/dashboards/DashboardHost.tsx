import { useEffect, useMemo, useState, type ComponentType } from "react";
import {
  compileDashboard,
  type DashboardProps,
} from "../../services/dashboard-compiler";
import { buildDashboardProps } from "../../services/dashboard-context";
import { DEFAULT_CONFIG } from "../../services/defaults";
import { useConfigStore } from "../../store/config";
import { useDashboardStore } from "../../store/dashboards";
import { useEntityStore } from "../../store/entities";
import { useScheduleStore } from "../../store/schedule";
import { DashboardCompileErrorPanel } from "./DashboardCompileErrorPanel";
import { DashboardErrorBoundary } from "./DashboardErrorBoundary";

interface Props {
  id: string;
}

type LoadState =
  | { kind: "loading" }
  | { kind: "ready"; Component: ComponentType<DashboardProps> }
  | { kind: "error"; error: Error };

export function DashboardHost({ id }: Props) {
  const reloadToken = useDashboardStore((s) => s.reloadToken);
  const bumpReload = useDashboardStore((s) => s.bumpReload);
  const readSource = useDashboardStore((s) => s.readDashboardSource);
  const registry = useDashboardStore((s) => s.registry);
  const entities = useEntityStore((s) => s.entities);
  const blocks = useScheduleStore((s) => s.blocks);
  const startDate = useScheduleStore((s) => s.startDate);
  const currentWeek = useScheduleStore((s) => s.currentWeek);
  const templateApplied = useScheduleStore((s) => s.templateApplied);
  const config = useConfigStore((s) => s.config);

  const entry = registry.find((d) => d.id === id);
  const filename = entry?.file ?? `${id}.jsx`;

  // Wrap the in-memory schedule slice into the WeekFile shape that
  // dashboards expect (per spec). Keeps authors from poking around
  // in store internals.
  const schedule = useMemo(() => {
    if (!currentWeek || !startDate) return null;
    return {
      version: 1 as const,
      week: currentWeek,
      start_date: startDate,
      template_applied: templateApplied,
      blocks,
    };
  }, [currentWeek, startDate, templateApplied, blocks]);

  const [state, setState] = useState<LoadState>({ kind: "loading" });

  useEffect(() => {
    let cancelled = false;
    setState({ kind: "loading" });
    (async () => {
      try {
        const code = await readSource(id);
        if (cancelled) return;
        const Component = compileDashboard(code, filename);
        if (cancelled) return;
        setState({ kind: "ready", Component });
      } catch (e) {
        if (cancelled) return;
        setState({ kind: "error", error: e as Error });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id, reloadToken, readSource, filename]);

  // Surface async errors thrown inside the dashboard's useEffect /
  // setTimeout / promise chains. React error boundaries only catch
  // sync render exceptions, so without this an async failure prints
  // to the console and the dashboard silently shows stale UI.
  useEffect(() => {
    if (state.kind !== "ready") return;
    const onRejection = (e: PromiseRejectionEvent) => {
      const err =
        e.reason instanceof Error
          ? e.reason
          : new Error(`Unhandled rejection: ${String(e.reason)}`);
      setState({ kind: "error", error: err });
    };
    window.addEventListener("unhandledrejection", onRejection);
    return () => window.removeEventListener("unhandledrejection", onRejection);
  }, [state.kind]);

  if (state.kind === "loading") {
    return <div className="dash-loading">Загрузка...</div>;
  }
  if (state.kind === "error") {
    return <DashboardCompileErrorPanel error={state.error} />;
  }

  // DEFAULT_CONFIG (not `{}`) keeps `config.areas.map(...)` and
  // friends from throwing inside dashboards before the user's real
  // config has loaded.
  const props = buildDashboardProps({
    entities,
    schedule,
    config: config ?? DEFAULT_CONFIG,
    allWeeks: [],
  });

  const Component = state.Component;
  return (
    <DashboardErrorBoundary
      key={`${id}-${reloadToken}`}
      onRetry={bumpReload}
    >
      <div className="dash-host">
        <Component {...props} />
      </div>
    </DashboardErrorBoundary>
  );
}
