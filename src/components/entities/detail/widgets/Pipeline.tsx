import { PIPELINE_LABELS_RU } from "../../../../services/entity-icons";

interface Props {
  // Accept any string — the schema (as of phase 4 review) now allows
  // custom pipeline stages defined in Settings, not just the canned
  // enum. Known ids get a Russian label; unknown ids render as-is.
  currentStage: string;
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
