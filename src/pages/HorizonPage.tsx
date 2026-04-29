import { useUIStore } from "../store/ui";

export function HorizonPage() {
  const active = useUIStore((s) => s.currentPage === "horizon");
  return (
    <div className={`page page-stub${active ? " active" : ""}`}>
      <div className="page-stub-title">Горизонт</div>
      <div className="page-stub-hint">В разработке (Phase 7)</div>
    </div>
  );
}
