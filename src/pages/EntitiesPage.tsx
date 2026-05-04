import { useUIStore } from "../store/ui";
import { EntityFilters } from "../components/entities/EntityFilters";
import { EntityList } from "../components/entities/EntityList";
import { EntityDetail } from "../components/entities/EntityDetail";

// Kept as a debug entry per Phase 9 D1 (spec §1.3 default A) — v1
// entity types (routine / event / contact / goal / note / metric) are
// not surfaced on the v2 top nav, but reach this page via Cmd+Shift+E.
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
