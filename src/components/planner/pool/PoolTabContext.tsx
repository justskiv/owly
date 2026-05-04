import { useMemo } from "react";
import type {
  DirectionEntity,
  PoolItem,
  ProjectEntity,
} from "../../../schemas";
import { useEntityStore } from "../../../store/entities";
import { usePoolStore } from "../../../store/pool";
import { useConfigStore } from "../../../store/config";
import { getAreaColor, pickAreaTag } from "../../../services/categories";
import { cadUrgClass, daysSince } from "../../../services/urgency";
import { removePoolItemAndBlocks } from "../../../services/pool-actions";
import { formatDate, getStartOfDay } from "../../../services/time-utils";
import { toast } from "../../shared/Toast";
import { SItem } from "./SItem";
import { errMsg } from "../../../services/format";

const EMPTY_AREAS: never[] = [];

export function PoolTabContext() {
  const entities = useEntityStore((s) => s.entities);
  const items = usePoolStore((s) => s.items);
  const addItem = usePoolStore((s) => s.addItem);
  const updateEntity = useEntityStore((s) => s.updateEntity);
  const config = useConfigStore((s) => s.config);
  const areas = config?.areas ?? EMPTY_AREAS;

  const directions = useMemo(
    () =>
      entities.filter(
        (e): e is DirectionEntity => e.type === "direction",
      ),
    [entities],
  );

  const projectsByDirection = useMemo(() => {
    const m = new Map<string, ProjectEntity[]>();
    for (const e of entities) {
      if (e.type !== "project") continue;
      const id = e.fields.direction_id;
      if (!id) continue;
      if (!m.has(id)) m.set(id, []);
      m.get(id)!.push(e);
    }
    return m;
  }, [entities]);

  const inPoolByEntity = useMemo(() => {
    const m = new Map<string, PoolItem>();
    for (const it of items) {
      if (
        (it.source_kind === "direction" || it.source_kind === "project") &&
        it.source_entity_id
      ) {
        m.set(it.source_entity_id, it);
      }
    }
    return m;
  }, [items]);

  const markCadence = async (d: DirectionEntity) => {
    try {
      const today = formatDate(getStartOfDay());
      await updateEntity(d.id, {
        fields: { ...d.fields, last_act: today },
      });
      toast.success(`✓ ${d.title}`);
    } catch (e) {
      toast.error(`Не удалось: ${errMsg(e)}`);
    }
  };

  // Pool toggle for a direction. The "in pool" indicator reflects
  // either the direction itself OR any linked project sitting in the
  // pool. Toggle removes whichever entry actually backs the indicator
  // — including a non-freshest linked project if that's what's in.
  // Otherwise: add freshest project (4h) or, if no linked projects,
  // the direction itself (2h). Spec §4.6 «Tab: Контекст».
  const togglePool = async (d: DirectionEntity) => {
    try {
      const existingDir = inPoolByEntity.get(d.id);
      if (existingDir) {
        await removePoolItemAndBlocks(existingDir.id);
        toast.success(`Удалено из пула: ${d.title}`);
        return;
      }
      const linked = projectsByDirection.get(d.id) ?? [];
      // If ANY linked project is already in the pool, remove THAT
      // one. Without this, clicking "✓" when a non-freshest project
      // is in the pool would silently add the freshest as a duplicate.
      for (const p of linked) {
        const linkedExisting = inPoolByEntity.get(p.id);
        if (linkedExisting) {
          await removePoolItemAndBlocks(linkedExisting.id);
          toast.success(`Удалено из пула: ${p.title}`);
          return;
        }
      }
      if (linked.length === 0) {
        const cat = pickAreaTag(d.tags, areas) ?? d.tags[0] ?? "work";
        await addItem({
          title: d.title,
          hours: 2,
          category: cat,
          splittable: true,
          source_entity_id: d.id,
          source_kind: "direction",
          placed: false,
        });
        toast.success(`В пул: ${d.title}`, { category: cat });
        return;
      }
      const freshest = linked.reduce((a, b) =>
        a.fields.last_activity_days < b.fields.last_activity_days ? a : b,
      );
      const cat =
        pickAreaTag(freshest.tags, areas) ?? freshest.tags[0] ?? "work";
      await addItem({
        title: freshest.title,
        hours: 4,
        category: cat,
        splittable: true,
        source_entity_id: freshest.id,
        source_kind: "project",
        placed: false,
      });
      toast.success(`В пул: ${freshest.title}`, { category: cat });
    } catch (e) {
      toast.error(`Не удалось: ${errMsg(e)}`);
    }
  };

  if (directions.length === 0) {
    return <div className="pool-empty">Направлений нет.</div>;
  }

  return (
    <>
      {directions.map((d) => {
        const cat = pickAreaTag(d.tags, areas) ?? d.tags[0] ?? "work";
        const color = getAreaColor(cat, areas);
        const f = d.fields;
        const measurable = f.target !== null || f.current !== null;
        const linked = projectsByDirection.get(d.id) ?? [];
        const linkedInPool = linked.some((p) => inPoolByEntity.has(p.id));
        const inPool = inPoolByEntity.has(d.id) || linkedInPool;

        let meta: React.ReactNode = null;
        let bar: { value: number; color: string } | undefined;
        if (measurable && f.progress !== null) {
          meta = `${f.current ?? "—"} → ${f.target ?? "—"}`;
          bar = { value: f.progress / 100, color };
        } else if (f.cadence !== null) {
          const since = daysSince(f.last_act);
          const over = since !== null ? since - f.cadence : null;
          meta = (
            <>
              <span>{f.cadence_label ?? `1×/${f.cadence}д`}</span>
              {since !== null && (
                <span className={cadUrgClass(over)}>{since}д назад</span>
              )}
            </>
          );
        }

        return (
          <SItem
            key={d.id}
            color={color}
            title={d.title}
            meta={meta}
            bar={bar}
            secondaryAction={
              f.cadence !== null
                ? {
                    label: "✓",
                    variant: "cad",
                    onClick: () => void markCadence(d),
                    title: "Отметить выполнение",
                  }
                : undefined
            }
            primaryAction={{
              label: inPool ? "✓" : "→",
              active: inPool,
              onClick: () => void togglePool(d),
              title: inPool ? "Убрать из пула" : "В пул",
            }}
          />
        );
      })}
    </>
  );
}
