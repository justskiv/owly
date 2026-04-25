import type { ReactNode } from "react";

export type PillVariant = "default" | "accent" | "success" | "error" | "muted";

export interface PillProps {
  children: ReactNode;
  variant?: PillVariant;
}

const VARIANT_STYLES: Record<
  PillVariant,
  { bg: string; color: string; border: string }
> = {
  default: {
    bg: "var(--bg-tint-2)",
    color: "var(--text-secondary)",
    border: "var(--border)",
  },
  accent: {
    bg: "rgba(224,184,96,.15)",
    color: "var(--accent)",
    border: "rgba(224,184,96,.25)",
  },
  success: {
    bg: "rgba(48,216,136,.15)",
    color: "var(--success)",
    border: "rgba(48,216,136,.25)",
  },
  error: {
    bg: "rgba(224,104,120,.15)",
    color: "var(--error)",
    border: "rgba(224,104,120,.25)",
  },
  muted: {
    bg: "transparent",
    color: "var(--text-tertiary)",
    border: "var(--border)",
  },
};

export function Pill({ children, variant = "default" }: PillProps) {
  const s = VARIANT_STYLES[variant];
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "2px 8px",
        fontSize: "var(--fs-2xs)",
        fontWeight: 600,
        textTransform: "uppercase",
        letterSpacing: ".05em",
        borderRadius: "var(--radius-pill)",
        background: s.bg,
        color: s.color,
        border: `1px solid ${s.border}`,
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </span>
  );
}
