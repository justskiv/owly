import type { PointerEvent as ReactPointerEvent } from "react";
import { useMemo } from "react";
import type { Area, HorizonProjectState, ProjectEntity } from "../../schemas";
import {
  classifyProject,
  type BacklogSectionKind,
} from "../../services/horizon-helpers";
import { useHorizonStore } from "../../store/horizon";
import { BacklogSection } from "./BacklogSection";

interface Props {
  states: readonly HorizonProjectState[];
  projectsById: ReadonlyMap<string, ProjectEntity>;
  baseMonth: string;
  areas: readonly Area[];
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

const SECTIONS: BacklogSectionKind[] = ["active", "someday", "deferred"];

export function Backlog({
  states,
  projectsById,
  baseMonth,
  areas,
  highlightedProjectId,
  draggingProjectId,
  dragInProgress,
  onItemPointerDown,
}: Props) {
  const sectionCollapsed = useHorizonStore((s) => s.sectionCollapsed);

  // Classify in one pass; project entities missing from the lookup are
  // skipped (reconcile keeps these in sync, but a momentary lag during
  // delete-then-render shouldn't render undefined rows).
  const grouped = useMemo(() => {
    const out: Record<
      BacklogSectionKind,
      { state: HorizonProjectState; project: ProjectEntity }[]
    > = { active: [], someday: [], deferred: [] };
    for (const s of states) {
      const project = projectsById.get(s.project_id);
      if (!project) continue;
      out[classifyProject(s)].push({ state: s, project });
    }
    return out;
  }, [states, projectsById]);

  return (
    <aside className="hz-backlog" aria-label="Бэклог проектов">
      <div className="hz-backlog-header">Бэклог</div>
      <div className="hz-bl-scroll">
        {SECTIONS.map((kind) => (
          <BacklogSection
            key={kind}
            kind={kind}
            items={grouped[kind]}
            baseMonth={baseMonth}
            areas={areas}
            collapsed={sectionCollapsed[kind]}
            highlightedProjectId={highlightedProjectId}
            draggingProjectId={draggingProjectId}
            dragInProgress={dragInProgress}
            onItemPointerDown={onItemPointerDown}
          />
        ))}
      </div>
    </aside>
  );
}
