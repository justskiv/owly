import type { ReactNode, KeyboardEvent } from "react";
import type { EntityType, Status } from "../../schemas";
import { useEntityStore } from "../../store/entities";
import { useConfigStore } from "../../store/config";
import { useUIStore } from "../../store/ui";
import {
  ENTITY_FILTER_TYPES,
  ENTITY_ICONS,
  ENTITY_PLURAL_RU,
  STATUS_LABELS_RU,
} from "../../services/entity-icons";

const STATUS_OPTIONS: Status[] = ["active", "someday", "done"];

export function EntityFilters() {
  const entities = useEntityStore((s) => s.entities);
  const areas = useConfigStore((s) => s.config?.areas) ?? [];

  const filterType = useUIStore((s) => s.entityFilterType);
  const filterAreas = useUIStore((s) => s.entityFilterAreas);
  const filterStatuses = useUIStore((s) => s.entityFilterStatuses);
  const setType = useUIStore((s) => s.setEntityFilterType);
  const toggleArea = useUIStore((s) => s.toggleEntityFilterArea);
  const toggleStatus = useUIStore((s) => s.toggleEntityFilterStatus);

  const countByType = (t: EntityType) =>
    entities.filter((e) => e.type === t).length;
  const countByArea = (id: string) =>
    entities.filter((e) => e.tags.includes(id)).length;
  const countByStatus = (s: Status) =>
    entities.filter((e) => e.status === s).length;

  return (
    <aside className="ent-filters" aria-label="Фильтры сущностей">
      <div className="fs">
        <div className="fs-t">По типу</div>
        <FoItem
          active={filterType === "all"}
          label="Все"
          count={entities.length}
          onActivate={() => setType("all")}
        />
        {ENTITY_FILTER_TYPES.map((t) => (
          <FoItem
            key={t}
            active={filterType === t}
            label={
              <>
                <span style={{ width: 18, display: "inline-block" }}>
                  {ENTITY_ICONS[t]}
                </span>
                {ENTITY_PLURAL_RU[t]}
              </>
            }
            count={countByType(t)}
            onActivate={() => setType(t)}
          />
        ))}
      </div>

      <div className="fs">
        <div className="fs-t">По области</div>
        {areas.map((a) => (
          <FoItem
            key={a.id}
            active={filterAreas.includes(a.id)}
            label={
              <>
                <span className="fdot" style={{ background: a.color }} />
                {a.label}
              </>
            }
            count={countByArea(a.id)}
            onActivate={() => toggleArea(a.id)}
          />
        ))}
      </div>

      <div className="fs">
        <div className="fs-t">По статусу</div>
        {STATUS_OPTIONS.map((s) => (
          <FoItem
            key={s}
            active={filterStatuses.includes(s)}
            label={STATUS_LABELS_RU[s]}
            count={countByStatus(s)}
            onActivate={() => toggleStatus(s)}
          />
        ))}
      </div>
    </aside>
  );
}

interface FoItemProps {
  active: boolean;
  label: ReactNode;
  count: number;
  onActivate: () => void;
}

function FoItem({ active, label, count, onActivate }: FoItemProps) {
  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onActivate();
    }
  };
  return (
    <div
      className={`fo${active ? " active" : ""}`}
      role="button"
      tabIndex={0}
      onClick={onActivate}
      onKeyDown={onKey}
    >
      <span className="fo-label">{label}</span>
      <span className="fc">{count}</span>
    </div>
  );
}
