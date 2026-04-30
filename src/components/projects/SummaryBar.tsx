import { useUIStore } from "../../store/ui";

export function SummaryBar({
  total,
  stale,
}: {
  total: number;
  stale: number;
}) {
  const toggleStale = useUIStore((s) => s.toggleStaleFilter);
  return (
    <div className="summary-bar">
      <span>{total} активных</span>
      {stale > 0 && (
        <>
          {" · "}
          <span
            className="stale-link"
            role="button"
            tabIndex={0}
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
