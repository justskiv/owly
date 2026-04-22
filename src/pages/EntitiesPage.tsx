import { useUIStore } from "../store/ui";
import { useEntityStore } from "../store/entities";

export function EntitiesPage() {
  const active = useUIStore((s) => s.currentPage === "entities");
  const entities = useEntityStore((s) => s.entities);
  return (
    <div className={`page${active ? " active" : ""}`}>
      <div style={{ padding: 24 }}>
        <h1
          style={{
            fontSize: "var(--fs-xl)",
            fontWeight: 500,
            color: "var(--text-primary)",
            marginBottom: 8,
          }}
        >
          Сущности
        </h1>
        <p
          style={{
            color: "var(--text-secondary)",
            fontSize: "var(--fs-sm)",
          }}
        >
          Всего:{" "}
          <span style={{ fontFamily: "var(--mono)" }}>{entities.length}</span>
        </p>
      </div>
    </div>
  );
}
