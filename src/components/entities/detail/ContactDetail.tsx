import { useMemo } from "react";
import type { ContactEntity } from "../../../schemas";
import { useConfigStore } from "../../../store/config";
import { useEntityStore } from "../../../store/entities";
import { useScheduleStore } from "../../../store/schedule";
import { computeContactStats } from "../../../services/contact-stats";
import {
  fmtDur,
  dayIndexOfDate,
  WEEKDAYS_RU,
} from "../../../services/time-utils";
import { getAreaColor } from "../../../services/categories";
import { fmtShortDate } from "../../../services/format";
import { toast } from "../../shared/Toast";
import { ContactStatusWidget } from "./widgets/ContactStatus";

export function ContactDetail({ entity }: { entity: ContactEntity }) {
  const areas = useConfigStore((s) => s.config?.areas) ?? [];
  const blocks = useScheduleStore((s) => s.blocks);
  const weekStart = useScheduleStore((s) => s.startDate);

  const stats = useMemo(
    () => computeContactStats(entity.fields),
    [entity.fields],
  );
  const weekItems = useMemo(
    () => blocks.filter((b) => b.source_entity_id === entity.id),
    [blocks, entity.id],
  );

  const firstTag = entity.tags[0];
  const itemBg = firstTag ? `${getAreaColor(firstTag, areas)}1a` : undefined;

  // Both handlers re-read the entity from the store at call time —
  // closures over `entity` would lose intermediate edits if the user
  // clicks two checkboxes in quick succession (each handler would
  // build `next` from the same stale snapshot).
  const toggleTopic = (idx: number) => {
    const fresh = useEntityStore
      .getState()
      .entities.find((e) => e.id === entity.id);
    if (!fresh || fresh.type !== "contact") return;
    const next = fresh.fields.topics.map((t, i) =>
      i === idx ? { ...t, done: !t.done } : t,
    );
    useEntityStore
      .getState()
      .updateEntity(entity.id, {
        fields: { ...fresh.fields, topics: next },
      } as Partial<ContactEntity>)
      .catch((e) => toast.error(`Не удалось: ${(e as Error).message}`));
  };

  const removeTopic = (idx: number) => {
    const fresh = useEntityStore
      .getState()
      .entities.find((e) => e.id === entity.id);
    if (!fresh || fresh.type !== "contact") return;
    const next = fresh.fields.topics.filter((_, i) => i !== idx);
    useEntityStore
      .getState()
      .updateEntity(entity.id, {
        fields: { ...fresh.fields, topics: next },
      } as Partial<ContactEntity>)
      .then(() => toast.success("✕ Тема убрана"))
      .catch((e) => toast.error(`Не удалось: ${(e as Error).message}`));
  };

  return (
    <>
      <section className="edp-sec">
        <div className="edp-sec-title">Статус</div>
        <ContactStatusWidget stats={stats} />
      </section>

      {weekItems.length > 0 && (
        <section className="edp-sec">
          <div className="edp-sec-title">На этой неделе</div>
          {weekItems.map((b) => {
            const dayIdx = dayIndexOfDate(b.date, weekStart);
            const dayLabel = WEEKDAYS_RU[dayIdx] ?? "";
            return (
              <div
                key={b.id}
                className="ct-week-item"
                style={itemBg ? { background: itemBg } : undefined}
              >
                <span className="ct-week-day">{dayLabel}</span>
                <span className="ct-week-title">
                  {b.title} · {b.start}
                </span>
                <span className="ct-week-dur">{fmtDur(b.duration)}</span>
              </div>
            );
          })}
        </section>
      )}

      {entity.fields.topics.length > 0 && (
        <section className="edp-sec">
          <div className="edp-sec-title">
            Чеклист тем (
            {entity.fields.topics.filter((t) => t.done).length}/
            {entity.fields.topics.length})
          </div>
          {entity.fields.topics.map((t, i) => (
            <div
              key={i}
              className={`ct-cl-item${t.done ? " done" : ""}`}
              onClick={() => toggleTopic(i)}
            >
              <span className={`edp-chk${t.done ? " checked" : ""}`} />
              <span className="ct-cl-text">{t.text}</span>
              <button
                type="button"
                className="ct-cl-x"
                aria-label="Убрать тему"
                onClick={(e) => {
                  e.stopPropagation();
                  removeTopic(i);
                }}
              >
                ×
              </button>
            </div>
          ))}
        </section>
      )}

      {entity.fields.contact_history.length > 0 && (
        <section className="edp-sec">
          <div className="edp-sec-title">История контактов</div>
          {entity.fields.contact_history.map((h, i) => (
            <div key={i} className="ct-item">
              <span className="ct-dot" />
              <span className="ct-date">{fmtShortDate(h.date)}</span>
              <span>{h.note}</span>
            </div>
          ))}
        </section>
      )}

      {entity.fields.important_dates.length > 0 && (
        <section className="edp-sec">
          <div className="edp-sec-title">Важные даты</div>
          {entity.fields.important_dates.map((d, i) => (
            <div key={i} className="ct-date-item">
              <span className="ct-date-icon">{d.icon || "📅"}</span>
              <span className="ct-date-label">{d.label}</span>
              <span className="ct-date-val">{d.date}</span>
            </div>
          ))}
        </section>
      )}

      {entity.fields.notes && (
        <section className="edp-sec">
          <div className="edp-sec-title">Заметки</div>
          <div className="edp-desc">{entity.fields.notes}</div>
        </section>
      )}
    </>
  );
}
