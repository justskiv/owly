import { memo, useRef } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import type { Area, PoolItem, ProjectEntity } from "../../schemas";
import { useUIStore } from "../../store/ui";
import { usePoolStore } from "../../store/pool";
import {
  pickAreaTag,
  getAreaColor,
  getAreaLabel,
} from "../../services/categories";
import { STALE_THRESHOLD_DAYS } from "../../services/projects-helpers";
import { toast } from "../shared/Toast";

const POOL_DEFAULT_HOURS = 4;
const FALLBACK_AREA_COLOR = "var(--text-tertiary)";

interface Props {
  project: ProjectEntity;
  dragging: boolean;
  poolItem: PoolItem | undefined;
  areas: readonly Area[];
  onPointerDown: (
    e: ReactPointerEvent<HTMLDivElement>,
    project: ProjectEntity,
    onClick: () => void,
  ) => void;
}

function KanbanCardImpl({
  project,
  dragging,
  poolItem,
  areas,
  onPointerDown,
}: Props) {
  const openPopup = useUIStore((s) => s.openEntityPopup);
  const cardRef = useRef<HTMLDivElement>(null);
  // Locks pool toggle so a rapid double-click doesn't fire two
  // addItem/removeItem calls and end up with duplicate pool entries.
  const poolInFlightRef = useRef(false);

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

  const togglePool = async () => {
    if (poolInFlightRef.current) return;
    poolInFlightRef.current = true;
    try {
      const pool = usePoolStore.getState();
      // Re-check from current state; the closed-over poolItem may be
      // stale after a pending in-flight write.
      const live = pool.items.find(
        (i) =>
          i.source_kind === "project" && i.source_entity_id === project.id,
      );
      if (live) {
        await pool.removeItem(live.id);
        toast.success(`Убрано из пула: ${project.title}`);
      } else {
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
      }
    } catch (err) {
      toast.error(`Не удалось: ${(err as Error).message}`);
    } finally {
      poolInFlightRef.current = false;
    }
  };

  // Choose what a tap (no-drag mouseup) does based on where it landed.
  // Pointer capture + preventDefault on the card swallows the synthetic
  // click, so we route the action through the gesture hook directly
  // instead of relying on the button's native onClick.
  const handleCardPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    const fromPoolBtn =
      (e.target as HTMLElement).closest(".kc-pool-btn") !== null;
    onPointerDown(e, project, fromPoolBtn ? togglePool : open);
  };

  return (
    <div
      ref={cardRef}
      className={`kanban-card${dragging ? " dragging-source" : ""}`}
      onPointerDown={handleCardPointerDown}
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
        // onClick is for keyboard activation only (Enter/Space on focus).
        // Mouse interaction goes through the card's pointerdown above.
        onClick={togglePool}
      >
        {inPool ? "✓ В пуле" : "→ В пул"}
      </button>
    </div>
  );
}

export const KanbanCard = memo(KanbanCardImpl);
