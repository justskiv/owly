import { useMemo, type KeyboardEvent } from "react";
import type { Entity } from "../../schemas";
import { useEntityStore } from "../../store/entities";
import { useConfigStore } from "../../store/config";
import { useUIStore } from "../../store/ui";
import {
  ENTITY_ICONS,
  PRIORITY_LABELS_RU,
} from "../../services/entity-icons";
import { getAreaColor, getAreaLabel } from "../../services/categories";
import { fmtDur } from "../../services/time-utils";
import { fmtShortDate } from "../../services/format";

function entityInfoString(e: Entity): string {
  if (e.deadline) return `до ${fmtShortDate(e.deadline)}`;
  switch (e.type) {
    case "routine":
      return freqLabel(e);
    case "contact":
      return e.fields.desired_cadence_days
        ? `каждые ${e.fields.desired_cadence_days}д`
        : "";
    case "metric":
      return e.fields.unit;
    case "goal":
      return e.fields.target
        ? `цель: ${e.fields.target}`
        : "";
    case "event":
      return `${e.fields.time} · ${fmtDur(e.fields.duration)}`;
    default:
      return "";
  }
}

function freqLabel(e: Entity & { type: "routine" }): string {
  const f = e.fields;
  if (f.frequency === "daily") return "daily";
  if (f.frequency === "weekly") return `${f.days.length}x/week`;
  return f.days.length ? `${f.days.length}д/нед` : "custom";
}

export function EntityList() {
  const entities = useEntityStore((s) => s.entities);
  const areas = useConfigStore((s) => s.config?.areas) ?? [];
  const filterType = useUIStore((s) => s.entityFilterType);
  const filterAreas = useUIStore((s) => s.entityFilterAreas);
  const filterStatuses = useUIStore((s) => s.entityFilterStatuses);
  const search = useUIStore((s) => s.entitySearch);
  const selectedId = useUIStore((s) => s.selectedEntityId);
  const setSelected = useUIStore((s) => s.setSelectedEntity);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return entities.filter((e) => {
      if (filterType !== "all" && e.type !== filterType) return false;
      if (
        filterAreas.length > 0 &&
        !e.tags.some((t) => filterAreas.includes(t))
      ) {
        return false;
      }
      if (!filterStatuses.includes(e.status)) return false;
      if (q && !e.title.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [entities, filterType, filterAreas, filterStatuses, search]);

  return (
    <div className="ent-list" role="list">
      {visible.map((e) => {
        const selected = selectedId === e.id;
        const onKey = (ev: KeyboardEvent<HTMLDivElement>) => {
          if (ev.key === "Enter" || ev.key === " ") {
            ev.preventDefault();
            setSelected(e.id);
          }
        };
        const info = entityInfoString(e);
        return (
          <div
            key={e.id}
            className={`erow${selected ? " selected" : ""}`}
            role="listitem"
            tabIndex={0}
            onClick={() => setSelected(e.id)}
            onKeyDown={onKey}
          >
            <div className="er-icon">{ENTITY_ICONS[e.type]}</div>
            <div className="er-body">
              <div className="er-top">
                <div className="er-title">{e.title}</div>
                {e.priority && (
                  <span className={`er-badge ${e.priority}`}>
                    {PRIORITY_LABELS_RU[e.priority]}
                  </span>
                )}
              </div>
              <div className="er-meta">
                {e.tags.map((t) => (
                  <span key={t} className="er-tag">
                    <span
                      className="td"
                      style={{ background: getAreaColor(t, areas) }}
                    />
                    {getAreaLabel(t, areas)}
                  </span>
                ))}
                {info && <span className="er-info">{info}</span>}
              </div>
            </div>
          </div>
        );
      })}
      {visible.length === 0 && (
        <div className="ent-list-empty">
          Нет сущностей по текущим фильтрам
        </div>
      )}
    </div>
  );
}
