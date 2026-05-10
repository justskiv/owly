import { useRef, type MouseEvent } from "react";
import type { TaskEntity } from "../../schemas";
import { useEntityStore } from "../../store/entities";
import { useUIStore } from "../../store/ui";
import { useConfigStore } from "../../store/config";
import {
  getAreaColor,
  getAreaLabel,
  pickAreaTag,
} from "../../services/categories";
import { formatRuDate } from "../../services/date-format-ru";
import { errMsg } from "../../services/format";
import { toast } from "../shared/Toast";
import { Tooltip } from "../shared/Tooltip";

const PRIO_LABEL: Record<NonNullable<TaskEntity["priority"]>, string> = {
  high: "Высокий",
  medium: "Средний",
  low: "Низкий",
};

const EMPTY_AREAS: never[] = [];

export function ArchiveRow({ task }: { task: TaskEntity }) {
  const updateEntity = useEntityStore((s) => s.updateEntity);
  const openPopup = useUIStore((s) => s.openEntityPopup);
  const closePopup = useUIStore((s) => s.closeEntityPopup);
  const areas = useConfigStore((s) => s.config?.areas ?? EMPTY_AREAS);
  const rowRef = useRef<HTMLDivElement>(null);

  const areaTag = pickAreaTag(task.tags, areas);
  const catColor = areaTag
    ? getAreaColor(areaTag, areas)
    : "var(--text-tertiary)";
  const catLabel = areaTag ? getAreaLabel(areaTag, areas) : "";
  const prioLabel = task.priority ? PRIO_LABEL[task.priority] : null;

  const restore = (e: MouseEvent) => {
    e.stopPropagation();
    void updateEntity(task.id, { status: "active" })
      .then(() => toast.success(`Возвращено в работу: ${task.title}`))
      .catch((err) => toast.error(`Не удалось: ${errMsg(err)}`));
  };

  const onRowClick = () => {
    if (!rowRef.current) return;
    const popup = useUIStore.getState().entityPopup;
    if (popup.open && popup.entityId === task.id) {
      closePopup();
      return;
    }
    openPopup(
      task.id,
      { type: "rect", rect: rowRef.current.getBoundingClientRect() },
      "below",
    );
  };

  const dot = (
    <span
      className="ar-cat"
      style={{ background: catColor }}
      aria-label={catLabel || undefined}
      aria-hidden={!catLabel}
    />
  );

  const meta =
    catLabel && prioLabel
      ? `${catLabel} · ${prioLabel}`
      : catLabel || prioLabel || "";

  return (
    <div
      ref={rowRef}
      className="arch-row"
      data-entity-id={task.id}
      onClick={onRowClick}
    >
      <button
        type="button"
        className="ar-check checked"
        onClick={restore}
        aria-label={`Вернуть в работу: ${task.title}`}
      >
        ✓
      </button>
      <div className="ar-body">
        <span className="ar-title">{task.title}</span>
        {meta && <span className="ar-meta">{meta}</span>}
      </div>
      {task.completed_at && (
        <div className="ar-date">{formatRuDate(task.completed_at)}</div>
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
