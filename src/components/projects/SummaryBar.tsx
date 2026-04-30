import { useUIStore } from "../../store/ui";

export function SummaryBar({
  total,
  stale,
}: {
  total: number;
  stale: number;
}) {
  const staleFilter = useUIStore((s) => s.staleFilter);
  const toggleStale = useUIStore((s) => s.toggleStaleFilter);
  return (
    <div className="summary-bar">
      <span>{total} активных</span>
      {stale > 0 && (
        <>
          {" · "}
          <span
            className={`stale-link${staleFilter ? " active" : ""}`}
            role="button"
            tabIndex={0}
            aria-pressed={staleFilter}
            onClick={toggleStale}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                toggleStale();
              }
            }}
          >
            {stale} заброшенных
          </span>
        </>
      )}
    </div>
  );
}
