import {
  getStrokeOffset,
  ringCircumference,
} from "../../services/gauge-math";

interface GaugeProps {
  // Numeric values 0..100 render the ring; strings (e.g. "487ч",
  // "12") render as text-only — the ring is suppressed even if
  // `ring` is left at its default `true`.
  value: number | string;
  title: string;
  subtitle?: string;
  ring?: boolean;
  color?: string;
  fontSize?: number;
}

export function Gauge({
  value,
  title,
  subtitle,
  ring = true,
  color,
  fontSize,
}: GaugeProps) {
  const numericPct = typeof value === "number" ? value : null;
  const showRing = ring && numericPct !== null;
  const c = ringCircumference();

  return (
    <div className="rv-gauge">
      <div className="rv-gauge-ring">
        {showRing && (
          <svg viewBox="0 0 48 48">
            <circle
              cx={24}
              cy={24}
              r={19}
              fill="none"
              stroke="var(--bg-tint-1)"
              strokeWidth={5}
            />
            <circle
              cx={24}
              cy={24}
              r={19}
              fill="none"
              stroke={color ?? "var(--accent)"}
              strokeWidth={5}
              strokeLinecap="round"
              strokeDasharray={c}
              strokeDashoffset={getStrokeOffset(numericPct)}
            />
          </svg>
        )}
        <div
          className="rv-gauge-val"
          style={{
            color: color ?? "var(--text-primary)",
            ...(fontSize ? { fontSize } : {}),
          }}
        >
          {showRing ? `${numericPct}%` : value}
        </div>
      </div>
      <div className="rv-gauge-info">
        <div className="rv-gi-title">{title}</div>
        {subtitle && <div className="rv-gi-sub">{subtitle}</div>}
      </div>
    </div>
  );
}
