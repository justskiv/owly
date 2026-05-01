import { useEffect, useMemo, useRef, useState } from "react";
import type { Area, DirectionEntity, ProjectEntity } from "../../schemas";
import { useEntityStore } from "../../store/entities";
import { useUIStore } from "../../store/ui";
import { usePoolStore } from "../../store/pool";
import { getAreaColor, pickAreaTag } from "../../services/categories";
import {
  getPrimarySignal,
  projectsForDirection,
  projectsPlural,
} from "../../services/context-helpers";
import { formatDate, getStartOfDay } from "../../services/time-utils";
import { toast } from "../shared/Toast";
import { DirectionProjectRow } from "./DirectionProjectRow";
import { InlineCreateProject } from "./InlineCreateProject";

const POOL_DIRECTION_HOURS = 2;
const POOL_PROJECT_HOURS = 4;
const FALLBACK_AREA_COLOR = "var(--text-tertiary)";

interface Props {
  direction: DirectionEntity;
  areas: readonly Area[];
}

export function DirectionCard({ direction, areas }: Props) {
  const cardRef = useRef<HTMLDivElement>(null);
  const updateEntity = useEntityStore((s) => s.updateEntity);
  const entities = useEntityStore((s) => s.entities);
  const poolItems = usePoolStore((s) => s.items);
  const openPopup = useUIStore((s) => s.openEntityPopup);

  const [openedProjectId, setOpenedProjectId] = useState<string | null>(null);
  const [createProjectOpen, setCreateProjectOpen] = useState(false);
  const [peekOpen, setPeekOpen] = useState(false);
  const poolInFlightRef = useRef(false);

  const linked = useMemo(
    () => projectsForDirection(entities, direction.id),
    [entities, direction.id],
  );

  // Close inline project editor on outside click. Listener installs
  // only while one is open.
  useEffect(() => {
    if (!openedProjectId) return;
    const onDoc = (e: MouseEvent) => {
      if (!cardRef.current) return;
      if (!cardRef.current.contains(e.target as Node)) {
        setOpenedProjectId(null);
      }
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [openedProjectId]);

  const areaTag = pickAreaTag(direction.tags, areas);
  const color = areaTag ? getAreaColor(areaTag, areas) : FALLBACK_AREA_COLOR;

  // Pool indicator: direction itself OR any linked project. Toggle
  // off prefers direction's own item, then a linked project's; one
  // click removes one item — symmetry with the kanban toggle.
  const directionPoolItem = useMemo(
    () =>
      poolItems.find(
        (i) =>
          i.source_kind === "direction" &&
          i.source_entity_id === direction.id,
      ),
    [poolItems, direction.id],
  );
  const linkedPoolItem = useMemo(
    () =>
      poolItems.find(
        (i) =>
          i.source_kind === "project" &&
          linked.some((p: ProjectEntity) => p.id === i.source_entity_id),
      ),
    [poolItems, linked],
  );
  const inPool = !!directionPoolItem || !!linkedPoolItem;

  const onTopClick = () => {
    if (!cardRef.current) return;
    openPopup(
      direction.id,
      { type: "rect", rect: cardRef.current.getBoundingClientRect() },
      "right",
    );
  };

  const togglePool = async () => {
    if (poolInFlightRef.current) return;
    poolInFlightRef.current = true;
    try {
      const pool = usePoolStore.getState();
      if (directionPoolItem) {
        await pool.removeItem(directionPoolItem.id);
        toast.success(`Убрано из пула: ${direction.title}`);
      } else if (linkedPoolItem) {
        await pool.removeItem(linkedPoolItem.id);
        toast.success(`Убрано из пула: ${linkedPoolItem.title}`);
      } else if (linked.length === 0) {
        await pool.addItem({
          title: direction.title,
          hours: POOL_DIRECTION_HOURS,
          splittable: true,
          category: areaTag ?? "work",
          source_entity_id: direction.id,
          source_kind: "direction",
          placed: false,
        });
        toast.success(`В пул: ${direction.title}`, {
          category: areaTag ?? undefined,
        });
      } else {
        const freshest = linked.reduce((a, b) =>
          a.fields.last_activity_days < b.fields.last_activity_days ? a : b,
        );
        const cat = pickAreaTag(freshest.tags, areas) ?? "work";
        await pool.addItem({
          title: freshest.title,
          hours: POOL_PROJECT_HOURS,
          splittable: true,
          category: cat,
          source_entity_id: freshest.id,
          source_kind: "project",
          placed: false,
        });
        toast.success(`В пул: ${freshest.title}`, { category: cat });
      }
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      poolInFlightRef.current = false;
    }
  };

  const markCadence = async () => {
    const today = formatDate(getStartOfDay());
    try {
      await updateEntity(direction.id, {
        fields: { ...direction.fields, last_act: today },
      });
      toast.success(`✓ ${direction.title}`, {
        category: areaTag ?? undefined,
      });
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const unlink = async (projectId: string) => {
    const p = entities.find((e) => e.id === projectId);
    if (!p || p.type !== "project") return;
    try {
      await updateEntity(projectId, {
        fields: { ...p.fields, direction_id: null },
      });
      toast.success(`Отвязано: ${p.title}`);
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const onProjectToggle = (id: string) => {
    setOpenedProjectId((cur) => (cur === id ? null : id));
  };

  const f = direction.fields;
  const signal = getPrimarySignal(direction, linked);
  const showProgress = f.progress !== null;

  // Show peek when the user hovers long enough AND there's something
  // worth peeking at (linked projects). Empty / signal-only cards
  // don't deserve a peek — would just be a redundant overlay.
  const peekHasContent = linked.length > 0;

  const handleMouseEnter = () => {
    if (!peekHasContent) return;
    setPeekOpen(true);
  };

  const handleMouseLeave = () => {
    setPeekOpen(false);
    // Also close any open inline editor when leaving the card —
    // otherwise the editor stays open under a hidden peek.
    setOpenedProjectId(null);
  };

  return (
    <div
      className="dir-card"
      ref={cardRef}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <div className="dc-top" onClick={onTopClick}>
        <span className="dc-dot" style={{ background: color }} />
        <span className="dc-title">{direction.title}</span>
        {linked.length > 0 && (
          <span className="dc-count" aria-label={projectsPlural(linked.length)}>
            {linked.length}
          </span>
        )}
      </div>

      <div className={`dc-signal ${signal.urgency}${signal.empty ? " empty" : ""}`}>
        {signal.text}
      </div>

      {showProgress && (
        <div className="dc-progress" aria-hidden>
          <span style={{ width: `${f.progress}%`, background: color }} />
        </div>
      )}

      {createProjectOpen ? (
        <InlineCreateProject
          direction={direction}
          areas={areas}
          open={createProjectOpen}
          onClose={() => setCreateProjectOpen(false)}
        />
      ) : (
        <div className="dc-actions">
          <button
            type="button"
            className={`btn-pool${inPool ? " in" : ""}`}
            onClick={togglePool}
          >
            {inPool ? "✓ В пуле" : "→ В пул"}
          </button>
          {f.cadence !== null && f.last_act && (
            <button
              type="button"
              className="btn-cadence"
              onClick={markCadence}
            >
              ✓ Отметить
            </button>
          )}
          <button
            type="button"
            className="btn-pool"
            style={{
              borderColor: "var(--text-tertiary)",
              color: "var(--text-tertiary)",
            }}
            onClick={() => setCreateProjectOpen(true)}
          >
            + Проект
          </button>
        </div>
      )}

      {peekOpen && peekHasContent && (
        <div className="dir-peek" role="tooltip">
          <div className="dir-peek-head">{projectsPlural(linked.length)}</div>
          <div className="dir-peek-body">
            {linked.map((p) => (
              <DirectionProjectRow
                key={p.id}
                project={p}
                isOpen={openedProjectId === p.id}
                onToggle={() => onProjectToggle(p.id)}
                onUnlink={() => unlink(p.id)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
