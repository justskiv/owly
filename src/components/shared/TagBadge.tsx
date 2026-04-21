import { useConfigStore } from "../../store/config";

export function TagBadge({ tag }: { tag: string }) {
  const config = useConfigStore((s) => s.config);
  const area = config?.areas.find((a) => a.id === tag);
  const color = area?.color ?? "#6B7280";
  const label = area?.label ?? tag;
  return (
    <span
      className="inline-flex rounded px-2 py-0.5 text-xs"
      style={{ backgroundColor: `${color}33`, color }}
    >
      {label}
    </span>
  );
}
