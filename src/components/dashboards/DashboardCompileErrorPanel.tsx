import { useDashboardStore } from "../../store/dashboards";

interface Props {
  error: Error;
}

// Shown when reading or transpiling the .jsx fails — i.e. before any
// React rendering happens. Distinct from DashboardErrorBoundary,
// which handles in-tree runtime errors.
export function DashboardCompileErrorPanel({ error }: Props) {
  const bumpReload = useDashboardStore((s) => s.bumpReload);
  return (
    <div className="dash-err">
      <div className="dash-err-title">Не удалось загрузить дашборд</div>
      <pre className="dash-err-msg">{error.message}</pre>
      {error.stack && (
        <details>
          <summary>Стек</summary>
          <pre>{error.stack}</pre>
        </details>
      )}
      <button type="button" className="hdr-btn" onClick={bumpReload}>
        ↻ Перечитать файл
      </button>
    </div>
  );
}
