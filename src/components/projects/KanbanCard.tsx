import { useRef } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import type { ProjectEntity } from "../../schemas";
import { useUIStore } from "../../store/ui";
import { useConfigStore } from "../../store/config";
import { usePoolStore } from "../../store/pool";
import {
  pickAreaTag,
  getAreaColor,
  getAreaLabel,
} from "../../services/categories";
import { STALE_THRESHOLD_DAYS } from "../../services/projects-helpers";
import { toast } from "../shared/Toast";

const EMPTY_AREAS: never[] = [];
const POOL_DEFAULT_HOURS = 4;
const FALLBACK_AREA_COLOR = "var(--text-tertiary)";

interface Props {
  project: ProjectEntity;
  dragging: boolean;
  onPointerDown: (
    e: ReactPointerEvent<HTMLDivElement>,
    project: ProjectEntity,
    open: () => void,
  ) => void;
}

export function KanbanCard({ project, dragging, onPointerDown }: Props) {
  const areas = useConfigStore((s) => s.config?.areas ?? EMPTY_AREAS);
  const openPopup = useUIStore((s) => s.openEntityPopup);
  const poolItem = usePoolStore((s) =>
    s.items.find(
      (i) =>
        i.source_kind === "project" && i.source_entity_id === project.id,
    ),
  );
  const cardRef = useRef<HTMLDivElement>(null);

  const areaTag = pickAreaTag(project.tags, areas);
  const color = areaTag ? getAreaColor(areaTag, areas) : FALLBACK_AREA_COLOR;
  const label = areaTag ? getAreaLabel(areaTag, areas) : "";
  const la = project.fields.last_activity_days;
  const stale = la >= STALE_THRESHOLD_DAYS;
  const inPool = !!poolItem;

  const open = () => {
    if (!cardRef.current) return;
    openPopup(
      project.id,
      { type: "rect", rect: cardRef.current.getBoundingClientRect() },
      "right",
    );
  };

  const togglePool = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const pool = usePoolStore.getState();
    if (poolItem) {
      await pool.removeItem(poolItem.id);
      toast.success(`Убрано из пула: ${project.title}`);
      return;
    }
    await pool.addItem({
      title: project.title,
      hours: POOL_DEFAULT_HOURS,
      // PoolItemSchema requires a non-empty category; fall back to
      // "work" so projects without an area tag still serialise.
      category: areaTag ?? "work",
      splittable: true,
      source_entity_id: project.id,
      source_kind: "project",
      placed: false,
    });
    toast.success(`В пул: ${project.title}`, {
      category: areaTag ?? undefined,
    });
  };

  return (
    <div
      ref={cardRef}
      className={`kanban-card${dragging ? " dragging-source" : ""}`}
      onPointerDown={(e) => onPointerDown(e, project, open)}
    >
      <div className="kc-title">{project.title}</div>
      <div className="kc-meta">
        {areaTag ? (
          <span
            className="kc-badge"
            style={{ background: `${color}20`, color }}
          >
            {label}
          </span>
        ) : (
          <span />
        )}
        <span className={`kc-days${stale ? " stale" : ""}`}>{la}д</span>
      </div>
      <button
        type="button"
        className={`btn-pool kc-pool-btn${inPool ? " in" : ""}`}
        // Stop pointerdown from reaching the card so the gesture hook
        // doesn't try to start a drag from the pool button.
        onPointerDown={(e) => e.stopPropagation()}
        onClick={togglePool}
      >
        {inPool ? "✓ В пуле" : "→ В пул"}
      </button>
    </div>
  );
}
