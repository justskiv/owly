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

const NO_ITEMS: PoolItem[] = [];

export function PoolSidebar({
  onPoolItemDragStart,
  onEntityDragStart,
}: Props) {
  const week = useScheduleStore((s) => s.currentWeek);
  const blocks = useScheduleStore((s) => s.blocks);
  const items = usePoolStore((s) => s.items);
  const poolWeek = usePoolStore((s) => s.currentWeek);
  const poolLoading = usePoolStore((s) => s.loading);

  // The schedule store updates `currentWeek` synchronously on
  // navigation; the pool store's `loadWeek` is awaited via a
  // subscription in App.tsx, so for ~one paint the sidebar can show
  // last week's items next to this week's grid. Worse: the user could
  // drag a stale item onto the new week, planting an orphan
  // `pool_item_id`. Suppress items until the pool catches up.
  const synced = poolWeek === week && !poolLoading;
  const safeItems = synced ? items : NO_ITEMS;
  const liveItems = useMemo(
    () => recalcPool(safeItems, blocks),
    [safeItems, blocks],
  );

  // Drag handlers are no-ops while desync'd so a click + drop can't
  // create a block tied to last week's pool item.
  const dragNoop = () => {};
  const poolDrag = synced ? onPoolItemDragStart : dragNoop;
  const entityDrag = synced ? onEntityDragStart : dragNoop;

  return (
    <aside className="pool-sidebar" aria-label="Боковая панель пула">
      <PoolHeader weekId={week} />
      <PoolBudget items={liveItems} blocks={blocks} />
      <PoolTabs />
      <PoolPanel
        items={liveItems}
        onPoolItemDragStart={poolDrag}
        onEntityDragStart={entityDrag}
      />
      <PoolAddModal />
    </aside>
  );
}
