import type { PointerEvent as ReactPointerEvent } from "react";
import type { Area, HorizonProjectState, ProjectEntity } from "../../schemas";
import {
  SECTION_META,
  type BacklogSectionKind,
} from "../../services/horizon-helpers";
import { useHorizonStore } from "../../store/horizon";
import { BacklogItem } from "./BacklogItem";

interface Item {
  state: HorizonProjectState;
  project: ProjectEntity;
}

interface Props {
  kind: BacklogSectionKind;
  items: Item[];
  baseMonth: string;
  areas: readonly Area[];
  collapsed: boolean;
  highlightedProjectId: string | null;
  draggingProjectId: string | null;
  dragInProgress: boolean;
  onItemPointerDown: (
    e: ReactPointerEvent<HTMLDivElement>,
    projectId: string,
    title: string,
    onTap: () => void,
  ) => void;
}

export function BacklogSection({
  kind,
  items,
  baseMonth,
  areas,
  collapsed,
  highlightedProjectId,
  draggingProjectId,
  dragInProgress,
  onItemPointerDown,
}: Props) {
  const meta = SECTION_META[kind];
  const toggle = () => {
    void useHorizonStore.getState().toggleSection(kind);
  };

  return (
    <div className="bl-section">
      <div className="bl-section-head" onClick={toggle}>
        <span>{meta.icon}</span>
        <span>{meta.label}</span>
        <span className="bl-section-cnt">{items.length}</span>
        <span className="bl-arrow">{collapsed ? "▶" : "▼"}</span>
      </div>
      {!collapsed &&
        items.map((it) => (
          <BacklogItem
            key={it.project.id}
            state={it.state}
            project={it.project}
            baseMonth={baseMonth}
            areas={areas}
            highlighted={highlightedProjectId === it.project.id}
            draggingNow={draggingProjectId === it.project.id}
            dragInProgress={dragInProgress}
            onItemPointerDown={onItemPointerDown}
          />
        ))}
    </div>
  );
}
