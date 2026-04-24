import { useUIStore } from "../store/ui";
import { EntityFilters } from "../components/entities/EntityFilters";
import { EntityList } from "../components/entities/EntityList";
import { EntityDetail } from "../components/entities/EntityDetail";

export function EntitiesPage() {
  const active = useUIStore((s) => s.currentPage === "entities");
  return (
    <div className={`page${active ? " active" : ""}`}>
      <div className="ent-content">
        <EntityFilters />
        <EntityList />
        <EntityDetail />
      </div>
    </div>
  );
}
