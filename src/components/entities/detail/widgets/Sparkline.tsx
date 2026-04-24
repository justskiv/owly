interface Props {
  data: number[]; // values ordered oldest → newest
  color: string;
  unit?: string;
  labels?: string[]; // optional x-axis labels (same length as data or fewer)
}

const W = 300;
const H = 70;
const PAD_L = 32;
const PAD_R = 8;
const PAD_T = 8;
const PAD_B = 4;

function fmt(n: number, unit = ""): string {
  if (Math.abs(n) >= 1000) {
    return `${Math.round(n / 100) / 10}K${unit}`;
  }
  return `${Math.round(n)}${unit}`;
}

export function Sparkline({ data, color, unit = "", labels = [] }: Props) {
  if (data.length < 2) {
    return (
      <div style={{ color: "var(--text-tertiary)", fontSize: "var(--fs-sm)" }}>
        Недостаточно данных для графика
      </div>
    );
  }
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const cw = W - PAD_L - PAD_R;
  const ch = H - PAD_T - PAD_B;

  const pts = data.map((v, i) => {
    const x = PAD_L + (i * cw) / (data.length - 1);
    const y = PAD_T + ch - ((v - min) / range) * ch;
    return { x, y, v };
  });
  const polyPoints = pts.map((p) => `${p.x},${p.y}`).join(" ");
  const areaPoints =
    polyPoints +
    ` ${PAD_L + cw},${PAD_T + ch} ${PAD_L},${PAD_T + ch}`;

  const gridLines: number[] = [0, 1, 2, 3];

  return (
    <div className="sparkline">
      <div className="spark-y">
        <span>{fmt(max, unit)}</span>
        <span>{fmt((min + max) / 2, unit)}</span>
        <span>{fmt(min, unit)}</span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
        {gridLines.map((i) => {
          const y = PAD_T + (ch * i) / 3;
          return (
            <line
              key={i}
              className="grid-line"
              x1={PAD_L}
              y1={y}
              x2={W - PAD_R}
              y2={y}
            />
          );
        })}
        <polygon className="area" points={areaPoints} fill={color} />
        <polyline points={polyPoints} stroke={color} />
        {pts.map((p, i) => (
          <circle
            key={i}
            className={`dot${i === pts.length - 1 ? " dot-last" : ""}`}
            cx={p.x}
            cy={p.y}
            fill={color}
          />
        ))}
      </svg>
      {labels.length > 0 && (
        <div className="spark-x">
          {labels.map((l, i) => (
            <span key={i}>{l}</span>
          ))}
        </div>
      )}
    </div>
  );
}
