export interface ProgressBarProps {
  value: number;
  max?: number;
  color?: string;
  height?: number;
}

export function ProgressBar({
  value,
  max = 100,
  color = "var(--accent)",
  height = 6,
}: ProgressBarProps) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div
      style={{
        height,
        background: "var(--bg-tint-2)",
        borderRadius: "var(--radius-pill)",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          width: `${pct}%`,
          height: "100%",
          background: color,
          borderRadius: "var(--radius-pill)",
          transition: "width 240ms cubic-bezier(.22,1,.36,1)",
        }}
      />
    </div>
  );
}
