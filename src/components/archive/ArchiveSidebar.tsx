import { useMemo } from "react";
import type { TaskEntity } from "../../schemas";
import { useConfigStore } from "../../store/config";
import { useUIStore, type TaskPrioFilter } from "../../store/ui";

const PRIO_ROWS: Array<{
  key: TaskPrioFilter;
  icon: string;
  label: string;
}> = [
  { key: "high", icon: "⚡", label: "Высокий" },
  { key: "medium", icon: "●", label: "Средний" },
  { key: "low", icon: "○", label: "Низкий" },
];

const EMPTY_AREAS: never[] = [];

export function ArchiveSidebar({ doneTasks }: { doneTasks: TaskEntity[] }) {
  const areas = useConfigStore((s) => s.config?.areas ?? EMPTY_AREAS);
  const filter = useUIStore((s) => s.archiveFilter);
  const setCat = useUIStore((s) => s.setArchiveFilterCat);
  const setPrio = useUIStore((s) => s.setArchiveFilterPrio);

  // Faceted across cat/prio so each row's count reflects what would
  // actually render if you clicked it, given the other slot's current
  // value. Mirrors TasksSidebar's approach for active tasks.
  const countWith = useMemo(() => {
    return (catF: string | null, prioF: TaskPrioFilter | null): number => {
      let pool = doneTasks;
      if (catF) pool = pool.filter((t) => t.tags.includes(catF));
      if (prioF) pool = pool.filter((t) => t.priority === prioF);
      return pool.length;
    };
  }, [doneTasks]);

  return (
    <aside className="arch-side">
      <div className="ts-card">
        <h4>По категориям</h4>
        {areas.map((a) => (
          <button
            key={a.id}
            type="button"
            className={`ts-row${filter.cat === a.id ? " active" : ""}`}
            onClick={() => setCat(filter.cat === a.id ? null : a.id)}
          >
            <span
              className="ts-row-dot"
              style={{ background: a.color }}
              aria-hidden
            />
            <span>{a.label}</span>
            <span className="ts-row-count">
              {countWith(a.id, filter.prio)}
            </span>
          </button>
        ))}
      </div>

      <div className="ts-card">
        <h4>По приоритету</h4>
        {PRIO_ROWS.map((p) => (
          <button
            key={p.key}
            type="button"
            className={`ts-row${filter.prio === p.key ? " active" : ""}`}
            onClick={() => setPrio(filter.prio === p.key ? null : p.key)}
          >
            <span aria-hidden>{p.icon}</span>
            <span>{p.label}</span>
            <span className="ts-row-count">
              {countWith(filter.cat, p.key)}
            </span>
          </button>
        ))}
      </div>
    </aside>
  );
}
