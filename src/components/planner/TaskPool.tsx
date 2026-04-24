import { Fragment, useMemo, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { X } from "lucide-react";
import type { Entity, Priority } from "../../schemas";
import { useEntityStore } from "../../store/entities";
import { useScheduleStore } from "../../store/schedule";
import { useUIStore } from "../../store/ui";
import { fmtDur } from "../../services/time-utils";

// Category → CSS variable. Falls back to --text-tertiary for tags
// outside the canonical five (e.g. legacy data from entities.json).
const CAT_COLORS: Record<string, string> = {
  work: "var(--work)",
  people: "var(--people)",
  life: "var(--life)",
  growth: "var(--growth)",
  health: "var(--health)",
};

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
  const entities = useEntityStore((s) => s.entities);
  const blocks = useScheduleStore((s) => s.blocks);

  const [query, setQuery] = useState("");

  const unscheduled = useMemo(() => {
    const scheduled = new Set(
      blocks
        .map((b) => b.source_entity_id)
        .filter((id): id is string => id !== null),
    );
    const poolTypes = new Set(["task", "project", "event", "routine"]);
    return entities.filter(
      (e) =>
        !scheduled.has(e.id) &&
        e.status === "active" &&
        poolTypes.has(e.type),
    );
  }, [entities, blocks]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return unscheduled;
    return unscheduled.filter((e) => e.title.toLowerCase().includes(q));
  }, [unscheduled, query]);

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
  const category = entity.tags[0] ?? "work";
  const color = CAT_COLORS[category] ?? "var(--text-tertiary)";
  const dur = entity.estimated_minutes;
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
        <span className="pit" style={{ background: color }} />
        {category} · {dur !== null ? fmtDur(dur) : "—"}
      </div>
    </div>
  );
}
