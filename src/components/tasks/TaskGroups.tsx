import type { TaskGroups } from "../../services/group-tasks";
import { TaskRow } from "./TaskRow";

const GROUP_META: Array<{
  key: keyof TaskGroups;
  icon: string;
  label: string;
}> = [
  { key: "burning", icon: "🔥", label: "Горит" },
  { key: "urgent", icon: "⚡", label: "Срочно" },
  { key: "soon", icon: "📋", label: "Скоро" },
  { key: "someday", icon: "💤", label: "Когда-нибудь" },
  { key: "done", icon: "✓", label: "Готово" },
];

export function TaskGroupsView({
  groups,
  empty,
}: {
  groups: TaskGroups;
  empty: string | null;
}) {
  const visible = GROUP_META.filter((g) => groups[g.key].length > 0);
  if (visible.length === 0) {
    return (
      <div className="task-empty">{empty ?? "Нет задач"}</div>
    );
  }
  return (
    <>
      {visible.map((g) => (
        <div className="task-group" key={g.key}>
          <div className="task-group-head">
            <span aria-hidden>{g.icon}</span>
            <span>{g.label}</span>
            <span className="tg-count">{groups[g.key].length}</span>
          </div>
          {groups[g.key].map((t) => (
            <TaskRow task={t} key={t.id} />
          ))}
        </div>
      ))}
    </>
  );
}
