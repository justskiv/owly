import { Fragment, useMemo } from "react";
import type {
  Area,
  HorizonProjectState,
  HorizonSize,
  ProjectEntity,
} from "../../schemas";
import {
  SIZE_GROUPS,
  getHorizonMonths,
} from "../../services/horizon-helpers";
import { useHorizonStore } from "../../store/horizon";
import { HorizonGroupHeader } from "./HorizonGroupHeader";
import { HorizonRow } from "./HorizonRow";
import { HorizonDropRow } from "./HorizonDropRow";

interface Props {
  states: readonly HorizonProjectState[];
  projectsById: ReadonlyMap<string, ProjectEntity>;
  baseMonth: string;
  areas: readonly Area[];
  highlightedProjectId: string | null;
  dropMonthIndex: number | null;
}

export function HorizonBoard({
  states,
  projectsById,
  baseMonth,
  areas,
  highlightedProjectId,
  dropMonthIndex,
}: Props) {
  const months = useMemo(() => getHorizonMonths(baseMonth), [baseMonth]);
  const groupCollapsed = useHorizonStore((s) => s.groupCollapsed);

  // Per spec §8.3 a project is "on the board" only when it has at
  // least one month chip. Empty-months projects live in the backlog's
  // "Когда-нибудь" section — adding them to the board would also
  // misclassify them as "Актуальное" (which is computed from
  // months.length>0). Hidden projects always live in "Скрытое",
  // regardless of months. Then partition by size into the three groups.
  const boardByGroup = useMemo(() => {
    const out: Record<HorizonSize, { state: HorizonProjectState; project: ProjectEntity }[]> = {
      big: [], mid: [], small: [],
    };
    for (const s of states) {
      if (s.hidden) continue;
      if (s.months.length === 0) continue;
      const project = projectsById.get(s.project_id);
      if (!project) continue;
      out[s.size].push({ state: s, project });
    }
    return out;
  }, [states, projectsById]);

  const colspan = months.length + 1;

  return (
    <div className="hz-board">
      <div className="hz-toolbar">
        <span className="hz-title">Горизонт</span>
      </div>
      <div className="hz-grid-wrap">
        <table className="hz-grid">
          <thead>
            <tr>
              <th className="name-col">Проект</th>
              {months.map((m, i) => (
                <th key={i} className={m.isCurrent ? "current" : ""}>
                  {m.label}
                  {m.isCurrent && " · сейчас"}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {SIZE_GROUPS.map((g) => {
              const items = boardByGroup[g.id];
              // Empty group → no header at all (D12).
              if (items.length === 0) return null;
              const collapsed = groupCollapsed[g.id];
              return (
                <Fragment key={g.id}>
                  <HorizonGroupHeader
                    group={g.id}
                    label={g.label}
                    icon={g.icon}
                    count={items.length}
                    collapsed={collapsed}
                    colspan={colspan}
                  />
                  {!collapsed &&
                    items.map((it) => (
                      <HorizonRow
                        key={it.project.id}
                        state={it.state}
                        project={it.project}
                        monthCount={months.length}
                        currentMonthIdx={0}
                        areas={areas}
                        highlighted={highlightedProjectId === it.project.id}
                        dropMonthIndex={dropMonthIndex}
                      />
                    ))}
                </Fragment>
              );
            })}
          </tbody>
          <tfoot>
            <HorizonDropRow
              monthCount={months.length}
              currentMonthIdx={0}
              dropMonthIndex={dropMonthIndex}
            />
          </tfoot>
        </table>
      </div>
    </div>
  );
}
