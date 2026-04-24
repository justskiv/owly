import type { HeatmapWeek } from "../../../../services/routine-stats";

interface Props {
  weeks: HeatmapWeek[];
}

const DAY_LABELS = ["Пн", "", "Ср", "", "Пт", "", ""];

export function Heatmap({ weeks }: Props) {
  return (
    <div className="heatmap-wrap">
      <div
        className="hm-months"
        style={{ marginLeft: 28, height: 14, marginBottom: 2 }}
      >
        {weeks.map((w, i) => (
          <div key={i} style={{ width: 13, flexShrink: 0 }}>
            {w.monthLabel && (
              <span
                style={{
                  fontSize: "var(--fs-xs)",
                  color: "var(--text-disabled)",
                  fontFamily: "var(--mono)",
                  whiteSpace: "nowrap",
                }}
              >
                {w.monthLabel}
              </span>
            )}
          </div>
        ))}
      </div>
      <div style={{ display: "flex" }}>
        <div className="hm-days">
          {DAY_LABELS.map((d, i) => (
            <span key={i}>{d}</span>
          ))}
        </div>
        <div className="hm-grid">
          {weeks.map((w, wi) => (
            <div key={wi} className="hm-col">
              {w.days.map((d, di) => (
                <div
                  key={di}
                  className={`hm-cell${d.level > 0 ? ` l${d.level}` : ""}`}
                  title={d.date}
                />
              ))}
            </div>
          ))}
        </div>
      </div>
      <div className="hm-legend">
        <span>Меньше</span>
        <div className="hm-cell" />
        <div className="hm-cell l1" />
        <div className="hm-cell l2" />
        <div className="hm-cell l3" />
        <div className="hm-cell l4" />
        <span>Больше</span>
      </div>
    </div>
  );
}
