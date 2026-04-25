import type { Entity } from "../../../../schemas";
import { useConfigStore } from "../../../../store/config";
import {
  ENTITY_ICONS,
  ENTITY_LABELS_RU,
  PRIORITY_LABELS_RU,
  STATUS_LABELS_RU,
} from "../../../../services/entity-icons";
import { getAreaColor, getAreaLabel } from "../../../../services/categories";
import { fmtShortDate, isOverdue } from "../../../../services/format";

export function DetailHeader({ entity }: { entity: Entity }) {
  const areas = useConfigStore((s) => s.config?.areas) ?? [];
  return (
    <div className="edp-head">
      <div className="edp-title">{entity.title}</div>
      {entity.tags.length > 0 && (
        <div className="edp-tags">
          {entity.tags.map((t) => {
            const color = getAreaColor(t, areas);
            return (
              <span
                key={t}
                className="edp-tag"
                style={{ background: `${color}22`, color }}
              >
                {getAreaLabel(t, areas)}
              </span>
            );
          })}
        </div>
      )}
      <div className="edp-type">
        <span className="edp-type-badge">
          <span className="tp-icon">{ENTITY_ICONS[entity.type]}</span>
          {ENTITY_LABELS_RU[entity.type]}
        </span>
        <span
          className={`edp-status${entity.status === "active" ? " active" : ""}`}
        >
          {STATUS_LABELS_RU[entity.status]}
        </span>
        {entity.priority && (
          <span className={`er-badge ${entity.priority}`}>
            {PRIORITY_LABELS_RU[entity.priority]}
          </span>
        )}
        {entity.deadline && (
          <span
            className={`edp-deadline${
              isOverdue(entity.deadline) && entity.status !== "done"
                ? " overdue"
                : ""
            }`}
          >
            📅 до {fmtShortDate(entity.deadline)}
          </span>
        )}
      </div>
    </div>
  );
}
