import { useMemo } from "react";
import type { PoolItem, ProjectEntity } from "../../../schemas";
import { useEntityStore } from "../../../store/entities";
import { usePoolStore } from "../../../store/pool";
import { useConfigStore } from "../../../store/config";
import { getAreaColor, pickAreaTag } from "../../../services/categories";
import { removePoolItemAndBlocks } from "../../../services/pool-actions";
import { toast } from "../../shared/Toast";
import { SItem } from "./SItem";
import { errMsg } from "../../../services/format";

const STALE_THRESHOLD = 14;
const EMPTY_AREAS: never[] = [];

export function PoolTabProjects() {
  // Stable refs only — filtering inside the selector returns a fresh
  // array each call, which trips React 19's getSnapshot guard.
  const entities = useEntityStore((s) => s.entities);
  const items = usePoolStore((s) => s.items);
  const addItem = usePoolStore((s) => s.addItem);
  const config = useConfigStore((s) => s.config);
  const areas = config?.areas ?? EMPTY_AREAS;

  const sorted = useMemo(() => {
    const projects = entities.filter(
      (e): e is ProjectEntity => e.type === "project",
    );
    const active = projects.filter((p) => p.status === "active");
    return active.sort(
      (a, b) =>
        a.fields.last_activity_days - b.fields.last_activity_days,
    );
  }, [entities]);

  const inPoolByEntity = useMemo(() => {
    const m = new Map<string, PoolItem>();
    for (const it of items) {
      if (it.source_kind === "project" && it.source_entity_id) {
        m.set(it.source_entity_id, it);
      }
    }
    return m;
  }, [items]);

  const togglePool = async (p: ProjectEntity) => {
    try {
      const existing = inPoolByEntity.get(p.id);
      if (existing) {
        await removePoolItemAndBlocks(existing.id);
        toast.success(`Удалено из пула: ${p.title}`);
        return;
      }
      const cat = pickAreaTag(p.tags, areas) ?? p.tags[0] ?? "work";
      await addItem({
        title: p.title,
        hours: 4,
        category: cat,
        splittable: true,
        source_entity_id: p.id,
        source_kind: "project",
        placed: false,
      });
      toast.success(`В пул: ${p.title}`, { category: cat });
    } catch (e) {
      toast.error(`Не удалось: ${errMsg(e)}`);
    }
  };

  if (sorted.length === 0) {
    return <div className="pool-empty">Активных проектов нет.</div>;
  }

  return (
    <>
      {sorted.map((p) => {
        const cat = pickAreaTag(p.tags, areas) ?? p.tags[0] ?? "work";
        const color = getAreaColor(cat, areas);
        const la = p.fields.last_activity_days;
        const stale = la >= STALE_THRESHOLD;
        const inPool = inPoolByEntity.has(p.id);
        return (
          <SItem
            key={p.id}
            color={color}
            title={p.title}
            meta={
              <span className={stale ? "stale" : undefined}>{la}д</span>
            }
            primaryAction={{
              label: inPool ? "✓" : "→",
              active: inPool,
              onClick: () => void togglePool(p),
              title: inPool ? "Убрать из пула" : "В пул",
            }}
          />
        );
      })}
    </>
  );
}
