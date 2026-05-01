import type { PointerEvent as ReactPointerEvent } from "react";
import type { Entity, PoolItem } from "../../schemas";
import type { PoolItemView } from "../../services/recalc-pool";
import { useUIStore } from "../../store/ui";
import { PoolTabPool } from "./pool/PoolTabPool";
import { PoolTabTasks } from "./pool/PoolTabTasks";
import { PoolTabProjects } from "./pool/PoolTabProjects";
import { PoolTabContext } from "./pool/PoolTabContext";

interface Props {
  items: PoolItemView[];
  onPoolItemDragStart: (
    e: ReactPointerEvent<HTMLDivElement>,
    item: PoolItem,
  ) => void;
  onEntityDragStart: (
    e: ReactPointerEvent<HTMLDivElement>,
    entity: Entity,
  ) => void;
}

export function PoolPanel({
  items,
  onPoolItemDragStart,
  onEntityDragStart,
}: Props) {
  const sideTab = useUIStore((s) => s.sideTab);
  return (
    <div className="pool-panel" role="tabpanel">
      {sideTab === "pool" && (
        <PoolTabPool items={items} onDragStart={onPoolItemDragStart} />
      )}
      {sideTab === "tasks" && <PoolTabTasks onDragStart={onEntityDragStart} />}
      {sideTab === "projects" && <PoolTabProjects />}
      {sideTab === "dirs" && <PoolTabContext />}
    </div>
  );
}
