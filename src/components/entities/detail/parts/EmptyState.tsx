import { FileText } from "lucide-react";

export function EmptyState() {
  return (
    <div className="edp-empty">
      <FileText size={40} strokeWidth={1.25} style={{ opacity: 0.3 }} />
      <span>Выбери сущность для просмотра деталей</span>
    </div>
  );
}
