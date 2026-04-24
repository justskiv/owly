import { useMemo } from "react";
import type { MetricEntity } from "../../../schemas";
import { useConfigStore } from "../../../store/config";
import { useEntityStore } from "../../../store/entities";
import { useUIStore } from "../../../store/ui";
import { computeMetricStats } from "../../../services/metric-stats";
import { getAreaColor } from "../../../services/categories";
import { BarChart } from "./widgets/BarChart";
import { StatFooter } from "./widgets/StatFooter";

function fmtNum(n: number): string {
  return n.toLocaleString("ru-RU");
}

export function MetricDetail({ entity }: { entity: MetricEntity }) {
  const areas = useConfigStore((s) => s.config?.areas) ?? [];
  const entities = useEntityStore((s) => s.entities);
  const setSelected = useUIStore((s) => s.setSelectedEntity);
  const f = entity.fields;
  const stats = useMemo(() => computeMetricStats(f.history), [f.history]);
  const firstTag = entity.tags[0] ?? "work";
  const color = getAreaColor(firstTag, areas);
  const down = stats.trend === "down";
  const linkedGoal =
    f.linked_goal_id !== null
      ? entities.find((e) => e.id === f.linked_goal_id && e.type === "goal")
      : null;

  return (
    <>
      <section className="edp-sec">
        <div className="metric-val">
          {fmtNum(f.current_value)} {f.unit}
        </div>
        {stats.sparkline.length > 1 && (
          <div className={`metric-change${down ? " down" : ""}`}>
            {down ? "↓" : "↑"} {fmtNum(Math.round(Math.abs(stats.change)))} за
            последний период ({stats.changePct >= 0 ? "+" : ""}
            {stats.changePct.toFixed(1)}%)
          </div>
        )}
      </section>

      {stats.bars.length > 0 && (
        <section className="edp-sec">
          <div className="edp-sec-title">Тренд (6 мес.)</div>
          <BarChart bars={stats.bars} color={color} />
        </section>
      )}

      <StatFooter
        items={[
          { label: "Единица", value: f.unit || "—" },
          {
            label: "Ср. рост",
            value:
              stats.avgGrowth !== 0
                ? `${stats.avgGrowth > 0 ? "+" : ""}${fmtNum(Math.round(stats.avgGrowth))}/шаг`
                : "—",
            color: stats.avgGrowth > 0 ? "success" : undefined,
          },
          {
            label: "Связанная цель",
            value: linkedGoal ? (
              <span
                role="button"
                tabIndex={0}
                style={{ cursor: "pointer", textDecoration: "underline" }}
                onClick={() => setSelected(linkedGoal.id)}
              >
                {linkedGoal.title}
              </span>
            ) : (
              "—"
            ),
          },
        ]}
      />
    </>
  );
}
