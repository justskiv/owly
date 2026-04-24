interface Bar {
  label: string;
  value: number;
}

interface Props {
  bars: Bar[];
  color: string;
}

const CHART_H = 90;

function fmtBarVal(v: number): string {
  if (Math.abs(v) >= 1000) return `${Math.round(v / 100) / 10}K`;
  return `${Math.round(v * 10) / 10}`;
}

export function BarChart({ bars, color }: Props) {
  if (bars.length === 0) {
    return (
      <div style={{ color: "var(--text-tertiary)", fontSize: "var(--fs-sm)" }}>
        Нет данных
      </div>
    );
  }
  const values = bars.map((b) => b.value);
  const minV = Math.min(...values);
  const maxV = Math.max(...values);
  const spread = maxV - minV;
  const baseV = minV - spread * 0.25;
  const range = maxV - baseV || 1;

  return (
    <div className="bar-chart">
      {bars.map((b, i) => {
        const px = Math.max(
          4,
          Math.round(((b.value - baseV) / range) * CHART_H),
        );
        const op = 0.35 + (i / bars.length) * 0.65;
        return (
          <div key={i} className="bar-col">
            <div className="bar-val">{fmtBarVal(b.value)}</div>
            <div className="bar-space" />
            <div
              className="bar-fill"
              style={{ height: px, background: color, opacity: op }}
            />
            <div className="bar-label">{b.label}</div>
          </div>
        );
      })}
    </div>
  );
}
