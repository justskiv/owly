import type { ReactNode } from "react";
import { ds } from "./style";

export interface StatProps {
  label: ReactNode;
  value: ReactNode;
  hint?: ReactNode;
  color?: string;
}

export function Stat({ label, value, hint, color }: StatProps) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <div style={ds.label}>{label}</div>
      <div
        style={{
          fontFamily: "var(--mono)",
          fontSize: "var(--fs-lg)",
          fontWeight: 500,
          color: color ?? "var(--text-primary)",
        }}
      >
        {value}
      </div>
      {hint != null && (
        <div
          style={{
            fontSize: "var(--fs-xs)",
            color: "var(--text-tertiary)",
          }}
        >
          {hint}
        </div>
      )}
    </div>
  );
}
