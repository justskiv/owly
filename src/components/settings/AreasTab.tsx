import type { Area } from "../../schemas";
import { useConfigStore } from "../../store/config";
import { useEntityStore } from "../../store/entities";
import { useScheduleStore } from "../../store/schedule";
import { toast } from "../shared/Toast";

function slug(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^\w]+/g, "-")
    .replace(/^-+|-+$/g, "") || "area";
}

export function AreasTab() {
  const areas = useConfigStore((s) => s.config?.areas) ?? [];
  const setAreas = useConfigStore((s) => s.setAreas);
  const entities = useEntityStore((s) => s.entities);
  const blocks = useScheduleStore((s) => s.blocks);

  const usageFor = (id: string) => ({
    entities: entities.filter((e) => e.tags.includes(id)).length,
    blocks: blocks.filter((b) => b.category === id).length,
  });

  const update = (idx: number, patch: Partial<Area>) => {
    const next = areas.map((a, i) => (i === idx ? { ...a, ...patch } : a));
    void setAreas(next);
  };

  const add = () => {
    const label = "Новая";
    let id = slug(label);
    const existing = new Set(areas.map((a) => a.id));
    let i = 1;
    while (existing.has(id)) {
      id = `${slug(label)}-${i++}`;
    }
    void setAreas([
      ...areas,
      { id, label, color: "#707070", icon: "" },
    ]);
  };

  const remove = (idx: number) => {
    const removed = areas[idx];
    if (!removed) return;
    const u = usageFor(removed.id);
    void setAreas(areas.filter((_, i) => i !== idx));
    if (u.entities > 0 || u.blocks > 0) {
      toast.error(
        `Область «${removed.label}» удалена, но используется в ` +
          `${u.entities} сущностях и ${u.blocks} блоках — теги и ` +
          `категории останутся как orphan`,
      );
    } else {
      toast.success(`Область удалена: ${removed.label}`);
    }
  };

  return (
    <div className="settings-inner">
      <div className="settings-hint">
        Цвет применяется к блокам и пилюлям сущностей с этим тегом.
        id не меняется — сущности привязываются к нему.
      </div>
      <div className="areas-list">
        {areas.map((a, i) => {
          const u = usageFor(a.id);
          return (
            <div key={a.id} className="area-row">
              <input
                type="color"
                className="area-color"
                value={a.color}
                onChange={(e) => update(i, { color: e.target.value })}
              />
              <input
                className="fi area-id"
                value={a.id}
                disabled
                title="id нельзя менять"
              />
              <input
                className="fi area-label"
                value={a.label}
                onChange={(e) => update(i, { label: e.target.value })}
              />
              <input
                className="fi area-icon"
                placeholder="icon"
                value={a.icon}
                onChange={(e) => update(i, { icon: e.target.value })}
              />
              <span
                className="pipe-usage"
                title={`${u.entities} сущностей · ${u.blocks} блоков`}
              >
                {u.entities + u.blocks}
              </span>
              <button
                type="button"
                className="editor-x"
                aria-label="Удалить"
                onClick={() => remove(i)}
              >
                ×
              </button>
            </div>
          );
        })}
        <button type="button" className="editor-add" onClick={add}>
          + Добавить область
        </button>
      </div>
    </div>
  );
}
