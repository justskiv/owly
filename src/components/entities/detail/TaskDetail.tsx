import type { TaskEntity } from "../../../schemas";
import { useEntityStore } from "../../../store/entities";
import { toast } from "../../shared/Toast";
import { Checklist } from "./parts/Checklist";
import { errMsg } from "../../../services/format";

export function TaskDetail({ entity }: { entity: TaskEntity }) {
  const items = entity.fields.checklist;
  const done = items.filter((i) => i.done).length;
  const total = items.length;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

  const toggle = (idx: number) => {
    // Read fresh entity from the store at click time, not from the
    // closure-captured props. Two fast checkbox clicks otherwise
    // both build their `next` from the same snapshot — second click
    // overwrites the first.
    const fresh = useEntityStore
      .getState()
      .entities.find((e) => e.id === entity.id);
    if (!fresh || fresh.type !== "task") return;
    const checklist = fresh.fields.checklist;
    const next = checklist.map((it, i) =>
      i === idx ? { ...it, done: !it.done } : it,
    );
    useEntityStore
      .getState()
      .updateEntity(entity.id, {
        fields: { ...fresh.fields, checklist: next },
      } as Partial<TaskEntity>)
      .catch((e) => toast.error(`Не удалось: ${errMsg(e)}`));
  };

  return (
    <>
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
