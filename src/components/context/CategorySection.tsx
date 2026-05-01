import type { KeyboardEvent } from "react";
import type { Area, Entity } from "../../schemas";
import { useUIStore } from "../../store/ui";
import { directionsForArea } from "../../services/context-helpers";
import { DirectionGrid } from "./DirectionGrid";
import { InlineCreateDirection } from "./InlineCreateDirection";

interface Props {
  area: Area;
  entities: readonly Entity[];
  areas: readonly Area[];
}

export function CategorySection({ area, entities, areas }: Props) {
  const collapsed = useUIStore((s) => !!s.contextCollapsed[area.id]);
  const toggle = useUIStore((s) => s.toggleContextSection);

  const directions = directionsForArea(entities, area.id);

  // Hide empty sections — matches mock behaviour. The user creates
  // the first direction in an empty category via Cmd+N (Quick Add).
  if (directions.length === 0) return null;

  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      toggle(area.id);
    }
  };

  return (
    <div className="cat-section">
      <div
        className="cat-section-head"
        role="button"
        tabIndex={0}
        onClick={() => toggle(area.id)}
        onKeyDown={onKey}
        aria-expanded={!collapsed}
      >
        <span className="cs-dot" style={{ background: area.color }} />
        <span className="cs-label">{area.label.toUpperCase()}</span>
        <span className="cs-arrow">{collapsed ? "▶" : "▼"}</span>
        <span className="cs-count">{directions.length}</span>
      </div>
      {!collapsed && (
        <>
          <DirectionGrid directions={directions} areas={areas} />
          <InlineCreateDirection area={area} />
        </>
      )}
    </div>
  );
}
