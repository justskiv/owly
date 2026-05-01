import type { PointerEvent as ReactPointerEvent } from "react";
import { useMemo } from "react";
import type { Entity, PoolItem } from "../../schemas";
import { useScheduleStore } from "../../store/schedule";
import { usePoolStore } from "../../store/pool";
import { recalcPool } from "../../services/recalc-pool";
import { PoolHeader } from "./PoolHeader";
import { PoolBudget } from "./PoolBudget";
import { PoolTabs } from "./PoolTabs";
import { PoolPanel } from "./PoolPanel";
import { PoolAddModal } from "./PoolAddModal";

interface Props {
  onPoolItemDragStart: (
    e: ReactPointerEvent<HTMLDivElement>,
    item: PoolItem,
  ) => void;
  onEntityDragStart: (
    e: ReactPointerEvent<HTMLDivElement>,
    entity: Entity,
  ) => void;
}

export function PoolSidebar({
  onPoolItemDragStart,
  onEntityDragStart,
}: Props) {
  const week = useScheduleStore((s) => s.currentWeek);
  const blocks = useScheduleStore((s) => s.blocks);
  const items = usePoolStore((s) => s.items);
  const liveItems = useMemo(() => recalcPool(items, blocks), [items, blocks]);

  return (
    <aside className="pool-sidebar" aria-label="Pool sidebar">
      <PoolHeader weekId={week} />
      <PoolBudget items={liveItems} blocks={blocks} />
      <PoolTabs />
      <PoolPanel
        items={liveItems}
        onPoolItemDragStart={onPoolItemDragStart}
        onEntityDragStart={onEntityDragStart}
      />
      <PoolAddModal />
    </aside>
  );
}
