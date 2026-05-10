import type { TaskGroups } from "../../services/group-tasks";
import { Tooltip } from "../shared/Tooltip";
import { TaskRow } from "./TaskRow";

const GROUP_META: Array<{
  key: keyof TaskGroups;
  icon: string;
  label: string;
  criterion: string;
}> = [
  { key: "burning", icon: "🔥", label: "Горит", criterion: "≤ 2 дней или просрочено" },
  { key: "urgent", icon: "⚡", label: "Срочно", criterion: "3–7 дней" },
  { key: "soon", icon: "📋", label: "Скоро", criterion: "8–30 дней" },
  { key: "notSoon", icon: "📆", label: "Не скоро", criterion: "более 30 дней" },
  { key: "someday", icon: "💤", label: "Когда-нибудь", criterion: "без дедлайна" },
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
          <Tooltip content={g.criterion} placement="above">
            <div className="task-group-head">
              <span aria-hidden>{g.icon}</span>
              <span>{g.label}</span>
              <span className="tg-count">{groups[g.key].length}</span>
            </div>
          </Tooltip>
          {groups[g.key].map((t) => (
            <TaskRow task={t} key={t.id} />
          ))}
        </div>
      ))}
    </>
  );
}
