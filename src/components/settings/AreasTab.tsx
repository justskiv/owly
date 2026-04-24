import type { Area } from "../../schemas";
import { useConfigStore } from "../../store/config";
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
    void setAreas(areas.filter((_, i) => i !== idx));
    toast.success(`Область удалена: ${removed.label}`);
  };

  return (
    <div className="settings-inner">
      <div className="settings-hint">
        Цвет применяется к блокам и пилюлям сущностей с этим тегом.
        id не меняется — сущности привязываются к нему.
      </div>
      <div className="areas-list">
        {areas.map((a, i) => (
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
            <button
              type="button"
              className="editor-x"
              aria-label="Удалить"
              onClick={() => remove(i)}
            >
              ×
            </button>
          </div>
        ))}
        <button type="button" className="editor-add" onClick={add}>
          + Добавить область
        </button>
      </div>
    </div>
  );
}
