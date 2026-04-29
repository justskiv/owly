import { useUIStore } from "../store/ui";

export function TasksPage() {
  const active = useUIStore((s) => s.currentPage === "tasks");
  return (
    <div className={`page page-stub${active ? " active" : ""}`}>
      <div className="page-stub-title">Задачи</div>
      <div className="page-stub-hint">В разработке (Phase 3)</div>
    </div>
  );
}
