import { ArrowLeft } from "lucide-react";
import { useUIStore } from "../../store/ui";

export function ArchiveHeader({ filteredCount }: { filteredCount: number }) {
  const setTasksView = useUIStore((s) => s.setTasksView);
  return (
    <div className="arch-header">
      <button
        type="button"
        className="arch-back"
        onClick={() => setTasksView("active")}
        aria-label="Назад к задачам"
      >
        <ArrowLeft size={16} aria-hidden />
      </button>
      <h1 className="arch-title">Архив</h1>
      <span className="arch-count">{filteredCount}</span>
    </div>
  );
}
