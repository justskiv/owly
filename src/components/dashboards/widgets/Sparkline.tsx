export interface SparklineProps {
  data: number[];
  color?: string;
  width?: number;
  height?: number;
  showDots?: boolean;
}

// Inline-SVG line chart. Single polyline + last-point dot. Designed
// for at-a-glance trends, not detailed analysis — dashboards needing
// axes/labels should reach for BarChart instead.
export function Sparkline({
  data,
  color = "var(--accent)",
  width = 160,
  height = 40,
  showDots = false,
}: SparklineProps) {
  if (data.length < 2) {
    return (
      <div
        style={{
          width,
          height,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: "var(--fs-xs)",
          color: "var(--text-tertiary)",
        }}
      >
        нет данных
      </div>
    );
  }

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const stepX = data.length === 1 ? 0 : width / (data.length - 1);

  const points = data.map((v, i) => {
    const x = i * stepX;
    const y = height - ((v - min) / range) * height;
    return [x, y] as const;
  });

  const polyline = points.map(([x, y]) => `${x},${y}`).join(" ");
  const last = points[points.length - 1];

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      style={{ display: "block" }}
    >
      <polyline
        points={polyline}
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      {showDots &&
        points.map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r={1.5} fill={color} opacity={0.6} />
        ))}
      <circle cx={last[0]} cy={last[1]} r={2.5} fill={color} />
    </svg>
  );
}
