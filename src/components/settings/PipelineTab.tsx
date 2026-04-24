import { useConfigStore } from "../../store/config";
import { useEntityStore } from "../../store/entities";
import { toast } from "../shared/Toast";

export function PipelineTab() {
  const stages = useConfigStore((s) => s.config?.pipeline_stages) ?? [];
  const setStages = useConfigStore((s) => s.setPipelineStages);
  const entities = useEntityStore((s) => s.entities);

  const usageCount = (stage: string) =>
    entities.filter(
      (e) => e.type === "project" && e.fields.pipeline_stage === stage,
    ).length;

  const update = (i: number, value: string) => {
    const next = stages.map((s, idx) => (idx === i ? value : s));
    void setStages(next);
  };

  const move = (i: number, delta: number) => {
    const j = i + delta;
    if (j < 0 || j >= stages.length) return;
    const next = [...stages];
    [next[i], next[j]] = [next[j], next[i]];
    void setStages(next);
  };

  const add = () => {
    let n = "new-stage";
    const existing = new Set(stages);
    let c = 1;
    while (existing.has(n)) n = `new-stage-${c++}`;
    void setStages([...stages, n]);
  };

  const remove = (i: number) => {
    const s = stages[i];
    if (!s) return;
    const n = usageCount(s);
    if (n > 0) {
      toast.error(
        `Стадия ${s} используется в ${n} проектах — удаление оставит их в устаревшем состоянии`,
      );
    }
    void setStages(stages.filter((_, idx) => idx !== i));
  };

  return (
    <div className="settings-inner">
      <div className="settings-hint">
        Порядок — это порядок прохождения. Удаление не правит связанные
        проекты — они останутся с неизвестной стадией до ручной правки.
      </div>
      <div className="pipeline-list">
        {stages.map((s, i) => (
          <div key={`${s}-${i}`} className="pipe-row">
            <button
              type="button"
              className="pipe-move"
              disabled={i === 0}
              onClick={() => move(i, -1)}
              aria-label="Выше"
            >
              ↑
            </button>
            <button
              type="button"
              className="pipe-move"
              disabled={i === stages.length - 1}
              onClick={() => move(i, 1)}
              aria-label="Ниже"
            >
              ↓
            </button>
            <input
              className="fi"
              value={s}
              onChange={(e) => update(i, e.target.value)}
            />
            <span className="pipe-usage">{usageCount(s)}</span>
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
          + Добавить стадию
        </button>
      </div>
    </div>
  );
}
