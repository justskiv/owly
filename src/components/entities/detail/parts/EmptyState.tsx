import { FileText } from "lucide-react";

export function EmptyState() {
  return (
    <div className="edp-empty">
      <FileText size={40} strokeWidth={1.25} style={{ opacity: 0.15 }} />
      <span>
        Выбери сущность
        <br />
        для просмотра деталей
      </span>
    </div>
  );
}
