import type { TaskEntity } from "../../../schemas";
import { useEntityStore } from "../../../store/entities";
import { Checklist } from "./parts/Checklist";

export function TaskDetail({ entity }: { entity: TaskEntity }) {
  const items = entity.fields.checklist;
  const done = items.filter((i) => i.done).length;
  const total = items.length;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

  const toggle = (idx: number) => {
    const next = items.map((it, i) =>
      i === idx ? { ...it, done: !it.done } : it,
    );
    void useEntityStore.getState().updateEntity(entity.id, {
      fields: { ...entity.fields, checklist: next },
    } as Partial<TaskEntity>);
  };

  return (
    <>
      {entity.description && (
        <section className="edp-sec">
          <div className="edp-sec-title">Заметки</div>
          <div className="edp-desc">{entity.description}</div>
        </section>
      )}
      {total > 0 && (
        <section className="edp-sec">
          <div className="edp-sec-title">
            Чеклист ({done}/{total})
          </div>
          <div className="edp-pbar">
            <div
              className="edp-pfill"
              style={{ width: `${pct}%`, background: "var(--success)" }}
            />
          </div>
          <Checklist items={items} onToggle={toggle} />
        </section>
      )}
    </>
  );
}
