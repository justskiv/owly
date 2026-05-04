import type { PointerEvent as ReactPointerEvent } from "react";
import { useMemo } from "react";
import type { Entity, PoolItem, TaskEntity } from "../../../schemas";
import { useEntityStore } from "../../../store/entities";
import { usePoolStore } from "../../../store/pool";
import { useConfigStore } from "../../../store/config";
import { getAreaColor } from "../../../services/categories";
import { daysUntil, formatDeadline, urgClass } from "../../../services/urgency";
import { removePoolItemAndBlocks } from "../../../services/pool-actions";
import { pickAreaTag } from "../../../services/categories";
import { toast } from "../../shared/Toast";
import { SItem } from "./SItem";
import { errMsg } from "../../../services/format";

interface Props {
  onDragStart: (e: ReactPointerEvent<HTMLDivElement>, entity: Entity) => void;
}

const PRIO_SCORE: Record<string, number> = { high: 0, medium: 1, low: 2 };
const PRIO_ICON: Record<string, string> = {
  high: "⚡",
  medium: "●",
  low: "○",
};
const EMPTY_AREAS: never[] = [];

function score(t: TaskEntity): number {
  const d = daysUntil(t.deadline);
  const da = d ?? 999;
  const pa = t.priority ? (PRIO_SCORE[t.priority] ?? 3) : 3;
  return (da < 0 ? da * 3 : da) + pa * 20;
}

export function PoolTabTasks({ onDragStart }: Props) {
  // Select stable references; derive filtered/sorted lists in useMemo.
  // Returning a freshly-filtered array from the selector trips React
  // 19's getSnapshot equality check and infinite-loops the render.
  const entities = useEntityStore((s) => s.entities);
  const items = usePoolStore((s) => s.items);
  const addItem = usePoolStore((s) => s.addItem);
  const config = useConfigStore((s) => s.config);
  const areas = config?.areas ?? EMPTY_AREAS;

  const sorted = useMemo(() => {
    const tasks = entities.filter(
      (e): e is TaskEntity => e.type === "task",
    );
    const active = tasks.filter((t) => t.status === "active");
    const done = tasks.filter((t) => t.status === "done");
    active.sort((a, b) => score(a) - score(b));
    done.sort((a, b) => (a.title < b.title ? -1 : 1));
    return { active, done };
  }, [entities]);

  const inPoolByEntity = useMemo(() => {
    const m = new Map<string, PoolItem>();
    for (const it of items) {
      if (it.source_kind === "task" && it.source_entity_id) {
        m.set(it.source_entity_id, it);
      }
    }
    return m;
  }, [items]);

  const togglePool = async (t: TaskEntity) => {
    try {
      const existing = inPoolByEntity.get(t.id);
      if (existing) {
        await removePoolItemAndBlocks(existing.id);
        toast.success(`Удалено из пула: ${t.title}`);
        return;
      }
      const cat = pickAreaTag(t.tags, areas) ?? t.tags[0] ?? "work";
      await addItem({
        title: t.title,
        hours: 1,
        category: cat,
        splittable: false,
        source_entity_id: t.id,
        source_kind: "task",
        placed: false,
      });
      toast.success(`В пул: ${t.title}`, { category: cat });
    } catch (e) {
      toast.error(`Не удалось: ${errMsg(e)}`);
    }
  };

  if (sorted.active.length === 0 && sorted.done.length === 0) {
    return <div className="pool-empty">Задач нет. Cmd+N — создать.</div>;
  }

  return (
    <>
      {sorted.active.map((t) => {
        const cat = pickAreaTag(t.tags, areas) ?? t.tags[0] ?? "work";
        const color = getAreaColor(cat, areas);
        const d = daysUntil(t.deadline);
        const inPool = inPoolByEntity.has(t.id);
        const meta = (
          <>
            {t.priority && <span>{PRIO_ICON[t.priority]}</span>}
            {d !== null && (
              <span className={urgClass(d)}>{formatDeadline(d)}</span>
            )}
          </>
        );
        return (
          <SItem
            key={t.id}
            color={color}
            title={t.title}
            meta={d !== null || t.priority ? meta : undefined}
            draggable
            onPointerDown={(e) => onDragStart(e, t)}
            primaryAction={{
              label: inPool ? "✓" : "→",
              active: inPool,
              onClick: () => void togglePool(t),
              title: inPool ? "Убрать из пула" : "В пул",
            }}
          />
        );
      })}
      {sorted.done.length > 0 && (
        <>
          <div className="pool-section">Готово ({sorted.done.length})</div>
          {sorted.done.map((t) => {
            const cat = pickAreaTag(t.tags, areas) ?? t.tags[0] ?? "work";
            return (
              <SItem
                key={t.id}
                color={getAreaColor(cat, areas)}
                title={t.title}
                done
              />
            );
          })}
        </>
      )}
    </>
  );
}
