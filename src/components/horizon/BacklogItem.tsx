import type { PointerEvent as ReactPointerEvent } from "react";
import type { Area, HorizonProjectState, ProjectEntity } from "../../schemas";
import { getAreaColor, pickAreaTag } from "../../services/categories";
import { useUIStore } from "../../store/ui";
import { useHorizonStore } from "../../store/horizon";
import { toast } from "../shared/Toast";
import { offsetToMonthLabel } from "../../services/horizon-helpers";

interface Props {
  state: HorizonProjectState;
  project: ProjectEntity;
  baseMonth: string;
  areas: readonly Area[];
  highlighted: boolean;
  draggingNow: boolean;
  // True while ANY backlog item is mid-drag. We use it to gate
  // mouseenter/leave: pointer capture keeps pointer events on the
  // source item, but mouse events still fire on items under the
  // cursor — without this guard the highlight would jump to whatever
  // item the dragged ghost passes over.
  dragInProgress: boolean;
  onItemPointerDown: (
    e: ReactPointerEvent<HTMLDivElement>,
    projectId: string,
    title: string,
    onTap: () => void,
  ) => void;
}

const FALLBACK_COLOR = "var(--text-tertiary)";

export function BacklogItem({
  state,
  project,
  baseMonth,
  areas,
  highlighted,
  draggingNow,
  dragInProgress,
  onItemPointerDown,
}: Props) {
  const setHorizonHighlight = useUIStore((s) => s.setHorizonHighlight);
  const horizonHighlight = useUIStore((s) => s.horizonHighlight);

  const areaTag = pickAreaTag(project.tags, areas);
  const color = areaTag ? getAreaColor(areaTag, areas) : FALLBACK_COLOR;

  // Click semantics differ when the item is hidden vs visible — picking
  // the right action at pointerdown time means the drag hook can hand
  // it back unchanged on a tap-without-move.
  const onTap = () => {
    if (state.hidden) {
      void useHorizonStore
        .getState()
        .setHidden(project.id, false)
        .catch((e: unknown) => {
          toast.error(`Не удалось: ${(e as Error).message}`);
        });
      return;
    }
    const cur = horizonHighlight;
    if (cur && cur.projectId === project.id && cur.fixed) {
      setHorizonHighlight(null);
      return;
    }
    setHorizonHighlight({ projectId: project.id, fixed: true });
  };

  const onMouseEnter = () => {
    if (dragInProgress) return;
    // Hover never overrides a fixed highlight from a previous click.
    if (horizonHighlight?.fixed) return;
    setHorizonHighlight({ projectId: project.id, fixed: false });
  };
  const onMouseLeave = () => {
    if (dragInProgress) return;
    if (horizonHighlight?.fixed) return;
    if (horizonHighlight?.projectId === project.id) {
      setHorizonHighlight(null);
    }
  };

  let cls = "hz-bl-item";
  if (highlighted) cls += " hl";
  if (state.hidden) cls += " hidden";
  if (draggingNow) cls += " dragging-source";

  return (
    <div
      className={cls}
      onPointerDown={(e) =>
        onItemPointerDown(e, project.id, project.title, onTap)
      }
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      <span className="bl-color" style={{ background: color }} />
      <span className="bl-title">{project.title}</span>
      {state.months.length > 0 && (
        <span className="bl-dots">
          {state.months
            .map((m) => offsetToMonthLabel(baseMonth, m))
            .join(" ")}
        </span>
      )}
    </div>
  );
}
