import { Fragment, useEffect, useMemo, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { ChevronDown, X } from "lucide-react";
import type { Entity, Priority } from "../../schemas";
import { useEntityStore } from "../../store/entities";
import { useScheduleStore } from "../../store/schedule";
import { useUIStore } from "../../store/ui";
import {
  DEFAULT_BLOCK_DURATION_MIN,
  fmtDur,
} from "../../services/time-utils";
import { CAT_COLORS, pickCategory } from "../../services/categories";
import { getCarryOverEntities } from "../../services/week-manager";

// null priority → "low" bucket. Keeps grouping exhaustive without a
// fourth "Без приоритета" group in the UI.
type PriorityKey = Exclude<Priority, null>;

const GROUPS: ReadonlyArray<{
  key: PriorityKey;
  label: string;
  dot: string;
}> = [
  { key: "high", label: "Высокий", dot: "var(--error)" },
  // Ochre — deliberately distinct from --accent and --life so
  // priority dots stay readable at 4px next to category chips.
  { key: "medium", label: "Средний", dot: "#c78a3a" },
  { key: "low", label: "Низкий", dot: "#707070" },
];

type PoolDragHandler = (
  e: ReactPointerEvent<HTMLDivElement>,
  entity: Entity,
) => void;

interface TaskPoolProps {
  onPoolItemPointerDown?: PoolDragHandler;
}

export function TaskPool({ onPoolItemPointerDown }: TaskPoolProps) {
  const poolCollapsed = useUIStore((s) => s.poolCollapsed);
  const togglePool = useUIStore((s) => s.togglePool);
  const carryCollapsed = useUIStore((s) => s.carryOverCollapsed);
  const toggleCarry = useUIStore((s) => s.toggleCarryOver);
  const entities = useEntityStore((s) => s.entities);
  const blocks = useScheduleStore((s) => s.blocks);
  const currentWeek = useScheduleStore((s) => s.currentWeek);

  const [query, setQuery] = useState("");
  const [carryOver, setCarryOver] = useState<Entity[]>([]);

  // Selector lives in the entity store so the definition of "what
  // belongs in the pool" has a single source of truth. useMemo caches
  // the result until the two subscriptions fire.
  const unscheduled = useMemo(
    () => useEntityStore.getState().getUnscheduled(blocks),
    // `entities` isn't textually read inside — getUnscheduled goes
    // through the store directly — but listing it is what triggers
    // recompute when entities change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [entities, blocks],
  );

  // Entities that had an unresolved planned block last week and no
  // block this week. Recomputed when the user navigates or the
  // entities set changes. Intentionally NOT depending on `blocks`:
  // carry-over is a function of (prev week file, entities, current
  // sources). Current-week block edits don't change the set, and
  // re-reading two files on every drag-move wastes I/O.
  useEffect(() => {
    let cancelled = false;
    void getCarryOverEntities(currentWeek, entities).then((x) => {
      if (!cancelled) setCarryOver(x);
    });
    return () => {
      cancelled = true;
    };
  }, [currentWeek, entities]);

  // Carry-over entities are rendered as their own section, so remove
  // them from the main unscheduled set — otherwise expanding the
  // "С прошлой недели" group shows the same item twice: once in the
  // carry section, once in its priority group below.
  const carryIds = useMemo(
    () => new Set(carryOver.map((e) => e.id)),
    [carryOver],
  );

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const pool = unscheduled.filter((e) => !carryIds.has(e.id));
    if (!q) return pool;
    return pool.filter((e) => e.title.toLowerCase().includes(q));
  }, [unscheduled, query, carryIds]);

  const grouped = useMemo(() => {
    const acc: Record<PriorityKey, Entity[]> = {
      high: [],
      medium: [],
      low: [],
    };
    for (const e of visible) {
      const key: PriorityKey = e.priority ?? "low";
      acc[key].push(e);
    }
    return acc;
  }, [visible]);

  return (
    <aside className={`pool${poolCollapsed ? " collapsed" : ""}`}>
      <div className="pool-hd">
        <span className="pool-t">Пул задач</span>
        <span className="pool-n">{visible.length}</span>
        <button
          type="button"
          className="pool-x"
          onClick={togglePool}
          aria-label="Скрыть пул"
        >
          <X />
        </button>
      </div>
      <div className="pool-s">
        <input
          type="text"
          placeholder="Поиск..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>
      <div className="pool-items">
        {carryOver.length > 0 && (
          <>
            <div
              className="pg pg-carry"
              role="button"
              tabIndex={0}
              onClick={toggleCarry}
              onKeyDown={(ev) => {
                if (ev.key === "Enter" || ev.key === " ") {
                  ev.preventDefault();
                  toggleCarry();
                }
              }}
            >
              <ChevronDown
                size={10}
                className={`pgc${carryCollapsed ? " collapsed" : ""}`}
              />
              С прошлой недели
              <span className="fc">{carryOver.length}</span>
            </div>
            {!carryCollapsed &&
              carryOver.map((e) => (
                <PoolItem
                  key={`carry-${e.id}`}
                  entity={e}
                  onPointerDown={onPoolItemPointerDown}
                />
              ))}
          </>
        )}
        {GROUPS.map(({ key, label, dot }) => {
          const items = grouped[key];
          if (!items.length) return null;
          return (
            <Fragment key={key}>
              <div className="pg">
                <span className="pgd" style={{ background: dot }} />
                {label}
              </div>
              {items.map((e) => (
                <PoolItem
                  key={e.id}
                  entity={e}
                  onPointerDown={onPoolItemPointerDown}
                />
              ))}
            </Fragment>
          );
        })}
      </div>
    </aside>
  );
}

interface PoolItemProps {
  entity: Entity;
  onPointerDown?: PoolDragHandler;
}

function PoolItem({ entity, onPointerDown }: PoolItemProps) {
  const category = pickCategory(entity.tags);
  // Meta mirrors the default used by the drop handler so dragging a
  // task without estimated_minutes lands a block of the same length
  // the user saw in the pool.
  const dur = entity.estimated_minutes ?? DEFAULT_BLOCK_DURATION_MIN;
  return (
    <div
      className="pi"
      data-entity-id={entity.id}
      onPointerDown={
        onPointerDown ? (e) => onPointerDown(e, entity) : undefined
      }
    >
      <div className="pi-t">{entity.title}</div>
      <div className="pi-m">
        <span className="pit" style={{ background: CAT_COLORS[category] }} />
        {category} · {fmtDur(dur)}
      </div>
    </div>
  );
}
