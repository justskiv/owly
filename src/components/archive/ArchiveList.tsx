import type { TaskEntity } from "../../schemas";
import type { ArchiveGroup as Group } from "../../services/archive-grouping";
import { ArchiveGroup } from "./ArchiveGroup";
import { ArchiveRow } from "./ArchiveRow";

export function ArchiveList({
  groups,
  flatTasks,
  totalDone,
}: {
  // null when sorting by title — list is rendered flat without month
  // group headers (groups by month would be meaningless when adjacent
  // rows are alphabetic).
  groups: Group[] | null;
  flatTasks: TaskEntity[];
  totalDone: number;
}) {
  if (totalDone === 0) {
    return (
      <div className="arch-empty">
        Архив пуст. Завершайте задачи — они будут собираться здесь.
      </div>
    );
  }
  if (flatTasks.length === 0) {
    return <div className="arch-empty">Нет задач по этому фильтру</div>;
  }
  if (groups === null) {
    return (
      <>
        {flatTasks.map((t) => (
          <ArchiveRow task={t} key={t.id} />
        ))}
      </>
    );
  }
  return (
    <>
      {groups.map((g) => (
        <ArchiveGroup group={g} key={g.key} />
      ))}
    </>
  );
}
