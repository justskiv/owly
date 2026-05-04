import { useRef, type MouseEvent } from "react";
import type { TaskEntity } from "../../schemas";
import { useEntityStore } from "../../store/entities";
import { useUIStore } from "../../store/ui";
import { useConfigStore } from "../../store/config";
import {
  daysUntil,
  formatDeadline,
  urgClass,
} from "../../services/urgency";
import {
  getAreaColor,
  getAreaLabel,
  pickAreaTag,
} from "../../services/categories";
import { errMsg } from "../../services/format";
import { toast } from "../shared/Toast";
import { Tooltip } from "../shared/Tooltip";

const PRIO_LABEL: Record<NonNullable<TaskEntity["priority"]>, string> = {
  high: "⚡ Высокий",
  medium: "● Средний",
  low: "○ Низкий",
};

const EMPTY_AREAS: never[] = [];

export function TaskRow({ task }: { task: TaskEntity }) {
  const updateEntity = useEntityStore((s) => s.updateEntity);
  const openPopup = useUIStore((s) => s.openEntityPopup);
  const areas = useConfigStore((s) => s.config?.areas ?? EMPTY_AREAS);
  const rowRef = useRef<HTMLDivElement>(null);

  const done = task.status === "done";
  const d = daysUntil(task.deadline);
  const areaTag = pickAreaTag(task.tags, areas);
  const catColor = areaTag
    ? getAreaColor(areaTag, areas)
    : "var(--text-tertiary)";
  const catLabel = areaTag ? getAreaLabel(areaTag, areas) : "";

  const toggleDone = (e: MouseEvent) => {
    e.stopPropagation();
    void updateEntity(task.id, { status: done ? "active" : "done" }).catch(
      (err) => toast.error(`Не удалось: ${errMsg(err)}`),
    );
  };

  const onRowClick = () => {
    if (!rowRef.current) return;
    openPopup(
      task.id,
      { type: "rect", rect: rowRef.current.getBoundingClientRect() },
      "below",
    );
  };

  const dot = (
    <span
      className="tr-cat"
      style={{ background: catColor }}
      aria-label={catLabel || undefined}
      aria-hidden={!catLabel}
    />
  );

  return (
    <div
      ref={rowRef}
      className={`task-row${done ? " done" : ""}`}
      onClick={onRowClick}
    >
      <button
        type="button"
        className={`tr-check${done ? " checked" : ""}`}
        onClick={toggleDone}
        aria-label={
          (done ? "Снять отметку: " : "Отметить выполненной: ") + task.title
        }
      >
        {done ? "✓" : ""}
      </button>
      <div className="tr-body">
        <div className="tr-title">{task.title}</div>
        {task.priority && (
          <div className="tr-sub">{PRIO_LABEL[task.priority]}</div>
        )}
      </div>
      {d !== null && (
        <div className={`tr-deadline ${urgClass(d)}`}>
          {formatDeadline(d)}
        </div>
      )}
      {areaTag ? (
        <Tooltip content={catLabel} delay={400} placement="above">
          {dot}
        </Tooltip>
      ) : (
        dot
      )}
    </div>
  );
}
