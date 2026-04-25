import { Children, type ReactNode } from "react";

export interface StatRowProps {
  children: ReactNode;
  gap?: number;
}

// Renders children in a flex row with subtle vertical separators
// between items (mirrors the StatFooter look from phase 4 detail
// panels, but inline-styled so dashboards don't depend on globals).
export function StatRow({ children, gap = 24 }: StatRowProps) {
  const items = Children.toArray(children);
  return (
    <div style={{ display: "flex", alignItems: "stretch", gap }}>
      {items.map((c, i) => (
        <div
          key={i}
          style={{
            paddingLeft: i === 0 ? 0 : gap,
            borderLeft:
              i === 0 ? "none" : "1px solid var(--border)",
            flex: 1,
          }}
        >
          {c}
        </div>
      ))}
    </div>
  );
}
