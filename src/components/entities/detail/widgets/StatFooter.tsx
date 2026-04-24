import type { ReactNode } from "react";

export interface StatFooterItem {
  label: string;
  value: ReactNode;
  color?: "success" | "error";
}

export function StatFooter({ items }: { items: StatFooterItem[] }) {
  return (
    <div className="stat-footer">
      {items.map((it, i) => (
        <div key={i} className="stat-f-item">
          <div className="stat-f-label">{it.label}</div>
          <div
            className="stat-f-val"
            style={
              it.color === "success"
                ? { color: "var(--success)" }
                : it.color === "error"
                  ? { color: "var(--error)" }
                  : undefined
            }
          >
            {it.value}
          </div>
        </div>
      ))}
    </div>
  );
}
