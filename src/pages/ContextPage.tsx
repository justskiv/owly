import { useUIStore } from "../store/ui";

export function ContextPage() {
  const active = useUIStore((s) => s.currentPage === "context");
  return (
    <div className={`page page-stub${active ? " active" : ""}`}>
      <div className="page-stub-title">Контекст</div>
      <div className="page-stub-hint">В разработке (Phase 5)</div>
    </div>
  );
}
