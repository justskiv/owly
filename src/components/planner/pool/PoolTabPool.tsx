import type { PointerEvent as ReactPointerEvent } from "react";
import type { PoolItem } from "../../../schemas";
import type { PoolItemView } from "../../../services/recalc-pool";
import { CAT_COLORS, type Category } from "../../../services/categories";
import { removePoolItemAndBlocks } from "../../../services/pool-actions";
import { toast } from "../../shared/Toast";
import { SItem } from "./SItem";

interface Props {
  items: PoolItemView[];
  onDragStart: (e: ReactPointerEvent<HTMLDivElement>, item: PoolItem) => void;
}

function colorFor(category: string): string {
  return CAT_COLORS[category as Category] ?? "var(--text-tertiary)";
}

async function handleRemove(item: PoolItemView) {
  try {
    await removePoolItemAndBlocks(item.id);
    toast.success(`Удалено: ${item.title}`);
  } catch (e) {
    toast.error((e as Error).message);
  }
}

export function PoolTabPool({ items, onDragStart }: Props) {
  const splittable = items.filter((it) => it.splittable);
  const atomic = items.filter((it) => !it.splittable);

  if (items.length === 0) {
    return (
      <div className="pool-empty">Пул пуст. Нажмите «+» чтобы добавить.</div>
    );
  }

  return (
    <>
      {splittable.length > 0 && (
        <>
          <div className="pool-section">Дробимые</div>
          {splittable.map((it) => {
            const color = colorFor(it.category);
            const ratio = it.hours > 0 ? it.scheduled / it.hours : 0;
            const done = it.scheduled >= it.hours;
            return (
              <SItem
                key={it.id}
                color={color}
                title={it.title}
                meta={`${it.scheduled.toFixed(1)} / ${it.hours}ч`}
                bar={{ value: ratio, color }}
                draggable
                done={done}
                onPointerDown={(e) => onDragStart(e, it)}
                primaryAction={{
                  label: "×",
                  onClick: () => void handleRemove(it),
                  title: "Удалить из пула",
                }}
              />
            );
          })}
        </>
      )}
      {atomic.length > 0 && (
        <>
          <div className="pool-section">Атомарные</div>
          {atomic.map((it) => {
            const color = colorFor(it.category);
            return (
              <SItem
                key={it.id}
                color={color}
                title={it.title}
                meta={`${it.hours}ч`}
                badge={it.placed ? "✓" : undefined}
                draggable={!it.placed}
                placed={it.placed}
                onPointerDown={
                  it.placed ? undefined : (e) => onDragStart(e, it)
                }
                primaryAction={{
                  label: "×",
                  onClick: () => void handleRemove(it),
                  title: "Удалить из пула",
                }}
              />
            );
          })}
        </>
      )}
    </>
  );
}
