import { useUIStore } from "../store/ui";

export function ProjectsPage() {
  const active = useUIStore((s) => s.currentPage === "projects");
  return (
    <div className={`page page-stub${active ? " active" : ""}`}>
      <div className="page-stub-title">Проекты</div>
      <div className="page-stub-hint">В разработке (Phase 4)</div>
    </div>
  );
}
