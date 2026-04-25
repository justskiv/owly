import type { ReactNode } from "react";
import { Card } from "./Card";
import { ds } from "./style";

export interface KpiCardProps {
  label: ReactNode;
  value: ReactNode;
  unit?: ReactNode;
  delta?: number | null;
  deltaLabel?: ReactNode;
  accent?: string;
  // For metrics where lower is better (weight, bugs, errors). When
  // true, a negative delta is shown green and a positive delta red.
  inverted?: boolean;
}

export function KpiCard({
  label,
  value,
  unit,
  delta,
  deltaLabel,
  accent,
  inverted = false,
}: KpiCardProps) {
  const goodWhenPositive = !inverted;
  const isGood =
    delta == null ? null : delta >= 0 === goodWhenPositive;
  const dColor =
    isGood == null
      ? null
      : isGood
        ? "var(--success)"
        : "var(--error)";
  return (
    <Card>
      <div style={{ ...ds.label, marginBottom: 8 }}>{label}</div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
        <span
          style={{
            ...ds.num,
            fontSize: "var(--fs-2xl)",
            color: accent ?? "var(--text-primary)",
          }}
        >
          {value}
        </span>
        {unit != null && (
          <span
            style={{
              color: "var(--text-tertiary)",
              fontSize: "var(--fs-sm)",
            }}
          >
            {unit}
          </span>
        )}
      </div>
      {delta != null && (
        <div
          style={{
            marginTop: 6,
            color: dColor ?? undefined,
            fontSize: "var(--fs-xs)",
            fontFamily: "var(--mono)",
          }}
        >
          {delta >= 0 ? "↑" : "↓"} {Math.abs(delta)}
          {deltaLabel ? ` ${deltaLabel}` : ""}
        </div>
      )}
    </Card>
  );
}
