import type { PipelineStage } from "../../../../schemas";
import { PIPELINE_LABELS_RU } from "../../../../services/entity-icons";

interface Props {
  currentStage: PipelineStage;
  stages: string[];
}

function stageLabel(s: string): string {
  return (PIPELINE_LABELS_RU as Record<string, string>)[s] ?? s;
}

export function Pipeline({ currentStage, stages }: Props) {
  const currentIdx = stages.indexOf(currentStage);
  return (
    <>
      <div className="pipe-current">{stageLabel(currentStage)}</div>
      <div className="pipeline">
        {stages.map((s, i) => {
          const cls =
            currentIdx === -1
              ? ""
              : i < currentIdx
                ? "done"
                : i === currentIdx
                  ? "current"
                  : "";
          return (
            <div key={s} className={`pipe-col${cls ? ` ${cls}` : ""}`}>
              <div className="pipe-bar" />
              <div className="pipe-name">{stageLabel(s)}</div>
            </div>
          );
        })}
      </div>
    </>
  );
}
