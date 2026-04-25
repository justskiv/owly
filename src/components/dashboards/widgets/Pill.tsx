import type { ReactNode } from "react";

export type PillVariant = "default" | "accent" | "success" | "error" | "muted";

export interface PillProps {
  children: ReactNode;
  variant?: PillVariant;
}

// Per-variant colour token keys. Background and border are derived
// at render time via color-mix so they always track the current
// theme — no rgba duplication of CSS-var values.
const VARIANT_TOKENS: Record<
  PillVariant,
  { color: string; mixVar: string | null; bg: string; border: string }
> = {
  default: {
    color: "var(--text-secondary)",
    mixVar: null,
    bg: "var(--bg-tint-2)",
    border: "var(--border)",
  },
  accent: {
    color: "var(--accent)",
    mixVar: "var(--accent)",
    bg: "color-mix(in srgb, var(--accent) 15%, transparent)",
    border: "color-mix(in srgb, var(--accent) 30%, transparent)",
  },
  success: {
    color: "var(--success)",
    mixVar: "var(--success)",
    bg: "color-mix(in srgb, var(--success) 15%, transparent)",
    border: "color-mix(in srgb, var(--success) 30%, transparent)",
  },
  error: {
    color: "var(--error)",
    mixVar: "var(--error)",
    bg: "color-mix(in srgb, var(--error) 15%, transparent)",
    border: "color-mix(in srgb, var(--error) 30%, transparent)",
  },
  muted: {
    color: "var(--text-tertiary)",
    mixVar: null,
    bg: "transparent",
    border: "var(--border)",
  },
};

export function Pill({ children, variant = "default" }: PillProps) {
  const t = VARIANT_TOKENS[variant];
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
        background: t.bg,
        color: t.color,
        border: `1px solid ${t.border}`,
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </span>
  );
}
