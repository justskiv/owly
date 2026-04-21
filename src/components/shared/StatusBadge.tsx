import type { BlockStatus } from "../../schemas";

const STATUS_LABELS: Record<BlockStatus, string> = {
  planned: "Запланировано",
  done: "Готово",
  skipped: "Пропущено",
  moved: "Перенесено",
};

const STATUS_COLORS: Record<BlockStatus, string> = {
  planned: "bg-blue-500/20 text-blue-300",
  done: "bg-green-500/20 text-green-300",
  skipped: "bg-slate-500/20 text-slate-400",
  moved: "bg-amber-500/20 text-amber-300",
};

export function StatusBadge({ status }: { status: BlockStatus }) {
  return (
    <span
      className={`inline-flex rounded px-2 py-0.5 text-xs ${STATUS_COLORS[status]}`}
    >
      {STATUS_LABELS[status]}
    </span>
  );
}
