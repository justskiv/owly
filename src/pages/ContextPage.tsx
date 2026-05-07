import { useMemo } from "react";
import { useEntityStore } from "../store/entities";
import { useAreas } from "../store/config";
import { sortAreasForContext } from "../services/context-helpers";
import { CategorySection } from "../components/context/CategorySection";

export function ContextPage() {
  const entities = useEntityStore((s) => s.entities);
  const areas = useAreas();
  const ordered = useMemo(() => sortAreasForContext(areas), [areas]);

  if (areas.length === 0) {
    return (
      <div className="context-page">
        <div className="projects-empty-stub">
          Сначала добавьте области в Settings
        </div>
      </div>
    );
  }

  return (
    <div className="context-page" data-screen="context">
      {ordered.map((a) => (
        <CategorySection
          key={a.id}
          area={a}
          entities={entities}
          areas={areas}
        />
      ))}
    </div>
  );
}
