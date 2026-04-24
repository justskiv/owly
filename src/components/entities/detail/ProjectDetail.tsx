import type { ProjectEntity } from "../../../schemas";
import { useConfigStore } from "../../../store/config";
import { useEntityStore } from "../../../store/entities";
import { useUIStore } from "../../../store/ui";
import { Pipeline } from "./widgets/Pipeline";
import { ENTITY_ICONS } from "../../../services/entity-icons";

export function ProjectDetail({ entity }: { entity: ProjectEntity }) {
  const stages = useConfigStore((s) => s.config?.pipeline_stages) ?? [];
  const entities = useEntityStore((s) => s.entities);
  const setSelected = useUIStore((s) => s.setSelectedEntity);
  const f = entity.fields;

  const tasks = entities.filter(
    (e) => e.type === "task" && f.task_ids.includes(e.id),
  );

  return (
    <>
      {f.description && (
        <section className="edp-sec">
          <div className="edp-sec-title">Описание</div>
          <div className="edp-desc">{f.description}</div>
        </section>
      )}
      <section className="edp-sec">
        <div className="edp-sec-title">Стадия</div>
        <Pipeline currentStage={f.pipeline_stage} stages={stages} />
      </section>
      {tasks.length > 0 && (
        <section className="edp-sec">
          <div className="edp-sec-title">Связанные задачи</div>
          <ul className="edp-cl">
            {tasks.map((t) => (
              <li
                key={t.id}
                className={
                  t.status === "done" ? "done" : ""
                }
                onClick={() => setSelected(t.id)}
                style={{ cursor: "pointer" }}
              >
                <span style={{ width: 18, display: "inline-block" }}>
                  {ENTITY_ICONS[t.type]}
                </span>
                <span className="edp-cl-text">{t.title}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
