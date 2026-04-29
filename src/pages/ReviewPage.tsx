import { useUIStore } from "../store/ui";

export function ReviewPage() {
  const active = useUIStore((s) => s.currentPage === "review");
  return (
    <div className={`page page-stub${active ? " active" : ""}`}>
      <div className="page-stub-title">Ревью</div>
      <div className="page-stub-hint">В разработке (Phase 8)</div>
    </div>
  );
}
