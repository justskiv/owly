// Shared style fragments used across dashboard widgets. Inline-style
// only — never reference globals.css class names from here. That
// keeps widgets portable and immune to design-system refactors in the
// rest of the app.

import type { CSSProperties } from "react";

export const ds = {
  card: {
    background: "var(--bg-tint-1)",
    border: "1px solid var(--border)",
    borderRadius: "var(--radius-lg)",
    padding: 16,
  } as CSSProperties,
  cardElevated: {
    background: "var(--bg-tint-2)",
    border: "1px solid var(--border-default)",
    borderRadius: "var(--radius-lg)",
    padding: 16,
  } as CSSProperties,
  mono: { fontFamily: "var(--mono)" } as CSSProperties,
  label: {
    fontSize: "var(--fs-xs)",
    color: "var(--text-tertiary)",
    fontWeight: 500,
    textTransform: "uppercase",
    letterSpacing: ".05em",
  } as CSSProperties,
  num: {
    fontFamily: "var(--mono)",
    fontSize: "var(--fs-xl)",
    fontWeight: 500,
    color: "var(--text-primary)",
  } as CSSProperties,
} as const;
