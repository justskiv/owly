import { useEffect, useState, type KeyboardEvent } from "react";
import type { TaskEntity } from "../../../schemas";
import { useEntityStore } from "../../../store/entities";
import { useConfigStore } from "../../../store/config";
import { toast } from "../../shared/Toast";
import { DeadlineField } from "./DeadlineField";

const PRIOS: Array<{ key: "high" | "medium" | "low"; icon: string; label: string }> = [
  { key: "high", icon: "⚡", label: "Высокий" },
  { key: "medium", icon: "●", label: "Средний" },
  { key: "low", icon: "○", label: "Низкий" },
];

function TrashIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 12 12"
      fill="none"
      aria-hidden
    >
      <path
        d="M2 3h8M4.5 3V2a.5.5 0 0 1 .5-.5h2a.5.5 0 0 1 .5.5v1M5 5.5v3M7 5.5v3M3 3l.5 7a1 1 0 0 0 1 1h3a1 1 0 0 0 1-1L9 3"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
    </svg>
  );
}

interface Props {
  task: TaskEntity;
  onClose: () => void;
}

export function TaskPopup({ task, onClose }: Props) {
  const updateEntity = useEntityStore((s) => s.updateEntity);
  const deleteEntity = useEntityStore((s) => s.deleteEntity);
  const areas = useConfigStore((s) => s.config?.areas ?? []);
  const [titleDraft, setTitleDraft] = useState(task.title);

  // Re-sync the local draft when the task title is edited from another
  // surface (e.g. EntityEditor) while this popup is open.
  useEffect(() => {
    setTitleDraft(task.title);
  }, [task.title]);

  const tags = task.tags;
  const areaIds = new Set(areas.map((a) => a.id));

  const setCategory = (id: string) => {
    const nonArea = tags.filter((t) => !areaIds.has(t));
    void updateEntity(task.id, { tags: [...nonArea, id] });
  };

  const setPrio = (p: "high" | "medium" | "low") => {
    void updateEntity(task.id, { priority: p });
  };

  const setDeadline = (iso: string | null) => {
    void updateEntity(task.id, { deadline: iso });
  };

  const persistTitle = () => {
    const t = titleDraft.trim();
    if (t && t !== task.title) void updateEntity(task.id, { title: t });
    else setTitleDraft(task.title);
  };

  const onTitleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.nativeEvent.isComposing) return;
    if (e.key === "Enter") {
      e.preventDefault();
      (e.target as HTMLInputElement).blur();
    }
  };

  const onDelete = () => {
    void deleteEntity(task.id);
    toast.success(`Удалено: ${task.title}`);
    onClose();
  };

  const activeCat = tags.find((t) => areaIds.has(t)) ?? null;

  return (
    <div className="ep-task" role="document">
      <div className="ep-task-head">
        <input
          className="ep-title"
          value={titleDraft}
          onChange={(e) => setTitleDraft(e.target.value)}
          onBlur={persistTitle}
          onKeyDown={onTitleKeyDown}
          aria-label="Название задачи"
          maxLength={200}
        />
        <button
          type="button"
          className="ep-close"
          onClick={onClose}
          aria-label="Закрыть"
        >
          ×
        </button>
      </div>

      <div className="ep-field">
        <div className="ep-label">Категория</div>
        <div className="ep-cat-dots">
          {areas.map((a) => (
            <button
              key={a.id}
              type="button"
              className={`ep-cat-dot${activeCat === a.id ? " on" : ""}`}
              style={{ background: a.color }}
              onClick={() => setCategory(a.id)}
              aria-label={a.label}
              aria-pressed={activeCat === a.id}
              title={a.label}
            />
          ))}
        </div>
      </div>

      <div className="ep-field">
        <div className="ep-label">Приоритет</div>
        <div className="ep-prio" role="radiogroup" aria-label="Приоритет">
          {PRIOS.map((p) => (
            <button
              key={p.key}
              type="button"
              className={`ep-prio-seg${task.priority === p.key ? " on" : ""}`}
              onClick={() => setPrio(p.key)}
              role="radio"
              aria-checked={task.priority === p.key}
            >
              <span className="ep-prio-icon" aria-hidden>
                {p.icon}
              </span>
              <span className="ep-prio-label">{p.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="ep-field">
        <div className="ep-label">Дедлайн</div>
        <DeadlineField value={task.deadline} onChange={setDeadline} />
      </div>

      <div className="ep-actions">
        <button type="button" className="ep-delete" onClick={onDelete}>
          <TrashIcon />
          <span>Удалить</span>
        </button>
      </div>
    </div>
  );
}
