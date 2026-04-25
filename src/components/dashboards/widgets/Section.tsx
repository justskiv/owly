import type { ReactNode } from "react";

export interface SectionProps {
  title?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
}

export function Section({ title, action, children }: SectionProps) {
  return (
    <section style={{ marginBottom: 24 }}>
      {title && (
        <header
          style={{
            display: "flex",
            alignItems: "center",
            marginBottom: 12,
            gap: 8,
          }}
        >
          <h3
            style={{
              fontSize: "var(--fs-md)",
              fontWeight: 500,
              color: "var(--text-primary)",
              margin: 0,
            }}
          >
            {title}
          </h3>
          {action && <div style={{ marginLeft: "auto" }}>{action}</div>}
        </header>
      )}
      {children}
    </section>
  );
}
