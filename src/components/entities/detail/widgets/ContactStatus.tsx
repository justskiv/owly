import type { ContactStats } from "../../../../services/contact-stats";
import { fmtShortDate } from "../../../../services/format";

export function ContactStatusWidget({ stats }: { stats: ContactStats }) {
  if (stats.state === "unknown") {
    return (
      <div className="ct-status">
        <div className="ct-ring" style={{ borderColor: "var(--text-tertiary)", color: "var(--text-tertiary)" }}>
          ?
        </div>
        <div className="ct-status-text">
          <div className="ct-status-title">Нет истории контактов</div>
          <div className="ct-status-sub">
            Установи «последний контакт» и частоту в редакторе
          </div>
        </div>
      </div>
    );
  }

  const overdue = stats.state === "overdue";
  const num = overdue ? stats.overdueDays : stats.nextInDays;
  const title = overdue
    ? `Просрочено на ${num} дн.`
    : `Через ${num} дн.`;

  return (
    <div className={`ct-status${overdue ? " overdue" : ""}`}>
      <div className={`ct-ring ${overdue ? "overdue" : "ok"}`}>
        {overdue ? "!" : "✓"}
      </div>
      <div className="ct-status-text">
        <div className="ct-status-title">{title}</div>
        <div className="ct-status-sub">
          Последний: {stats.lastContact ? fmtShortDate(stats.lastContact) : "—"} ·
          каждые {stats.cadence}д
        </div>
      </div>
      <div className="ct-countdown">
        <div className="ct-cd-num">{num}</div>
        <div className="ct-cd-label">дн. {overdue ? "назад" : "до"}</div>
      </div>
    </div>
  );
}
