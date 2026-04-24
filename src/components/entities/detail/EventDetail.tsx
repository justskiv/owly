import type { EventEntity } from "../../../schemas";
import { fmtDur } from "../../../services/time-utils";
import { fmtShortDate } from "../../../services/format";

export function EventDetail({ entity }: { entity: EventEntity }) {
  const f = entity.fields;
  return (
    <>
      {entity.description && (
        <section className="edp-sec">
          <div className="edp-sec-title">Описание</div>
          <div className="edp-desc">{entity.description}</div>
        </section>
      )}
      <section className="edp-sec">
        <div className="edp-sec-title">Время</div>
        <div className="edp-row">
          <span className="edp-label">Дата</span>
          <span className="edp-val">{fmtShortDate(f.date)}</span>
        </div>
        <div className="edp-row">
          <span className="edp-label">Время</span>
          <span className="edp-val" style={{ fontFamily: "var(--mono)" }}>
            {f.time}
          </span>
        </div>
        <div className="edp-row">
          <span className="edp-label">Длит.</span>
          <span className="edp-val" style={{ fontFamily: "var(--mono)" }}>
            {fmtDur(f.duration)}
          </span>
        </div>
        {f.location && (
          <div className="edp-row">
            <span className="edp-label">Место</span>
            <span className="edp-val">{f.location}</span>
          </div>
        )}
        {f.travel_time > 0 && (
          <div className="edp-row">
            <span className="edp-label">Дорога</span>
            <span className="edp-val" style={{ fontFamily: "var(--mono)" }}>
              {fmtDur(f.travel_time)} в одну сторону
            </span>
          </div>
        )}
      </section>
    </>
  );
}
