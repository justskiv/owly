import type { ReactNode } from "react";

export interface EmptyStateProps {
  title?: ReactNode;
  hint?: ReactNode;
  icon?: ReactNode;
}

export function EmptyState({
  title = "Нет данных",
  hint,
  icon = "—",
}: EmptyStateProps) {
  return (
    <div
      style={{
        textAlign: "center",
        padding: "48px 24px",
        color: "var(--text-tertiary)",
      }}
    >
      <div
        style={{
          fontSize: "var(--fs-2xl)",
          opacity: 0.4,
          marginBottom: 8,
        }}
      >
        {icon}
      </div>
      <div
        style={{
          fontSize: "var(--fs-md)",
          fontWeight: 500,
          color: "var(--text-secondary)",
          marginBottom: 4,
        }}
      >
        {title}
      </div>
      {hint != null && (
        <div style={{ fontSize: "var(--fs-sm)" }}>{hint}</div>
      )}
    </div>
  );
}
