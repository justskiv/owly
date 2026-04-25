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
}

export function KpiCard({
  label,
  value,
  unit,
  delta,
  deltaLabel,
  accent,
}: KpiCardProps) {
  const dColor =
    delta == null
      ? null
      : delta >= 0
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
