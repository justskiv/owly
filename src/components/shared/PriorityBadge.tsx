import { useConfigStore } from "../../store/config";
import type { Priority } from "../../schemas";

export function PriorityBadge({ priority }: { priority: Priority }) {
  const config = useConfigStore((s) => s.config);
  if (!priority || !config) return null;
  const p = config.priorities[priority];
  return (
    <span
      className="inline-flex rounded px-2 py-0.5 text-xs"
      style={{ backgroundColor: `${p.color}33`, color: p.color }}
    >
      {p.label}
    </span>
  );
}
