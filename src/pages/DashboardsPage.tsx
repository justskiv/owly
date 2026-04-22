import { useUIStore } from "../store/ui";

export function DashboardsPage() {
  const active = useUIStore((s) => s.currentPage === "dashboards");
  return (
    <div className={`page${active ? " active" : ""}`}>
      <div className="hdr">
        <div className="hdr-title">Дашборды</div>
        <div className="hdr-spacer" />
        <button type="button" className="hdr-btn" disabled>
          + Добавить
        </button>
      </div>
      <div style={{ padding: 24 }}>
        <h1
          style={{
            fontSize: "var(--fs-xl)",
            fontWeight: 500,
            color: "var(--text-primary)",
            marginBottom: 8,
          }}
        >
          Дашборды
        </h1>
        <p
          style={{
            color: "var(--text-secondary)",
            fontSize: "var(--fs-sm)",
          }}
        >
          Зарегистрировано: <span style={{ fontFamily: "var(--mono)" }}>0</span>
        </p>
      </div>
    </div>
  );
}
