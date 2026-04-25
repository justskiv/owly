export interface BarChartBar {
  label: string;
  value: number;
}

export interface BarChartProps {
  bars: BarChartBar[];
  color?: string;
  height?: number;
}

// Vertical bar chart with values above bars and labels below. Bars
// share a baseline derived from the smallest value (subtract baseV)
// so small relative changes show clearly — same approach as the
// MetricDetail chart in phase 4.
export function BarChart({
  bars,
  color = "var(--accent)",
  height = 120,
}: BarChartProps) {
  if (bars.length === 0) {
    return (
      <div
        style={{
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

  const values = bars.map((b) => b.value);
  const minV = Math.min(...values);
  const maxV = Math.max(...values);
  // When all values are equal we used to floor at `min - 1`, which
  // rendered every bar at 100% height — including the all-zero case,
  // visually lying that there is data. Now: equal values render flat
  // at a small fixed height so authors see "no variation, but data
  // exists". Real spread uses a 10% headroom below the minimum.
  const flat = minV === maxV;
  const baseV = flat ? minV : minV - (maxV - minV) * 0.1;
  const range = flat ? 1 : maxV - baseV;
  const flatHeight = 4;

  return (
    <div
      style={{
        display: "flex",
        gap: 6,
        alignItems: "flex-end",
        height: height + 36,
      }}
    >
      {bars.map((b, i) => {
        const fillHeight = flat
          ? flatHeight
          : ((b.value - baseV) / range) * height;
        const opacity = 0.4 + (i / Math.max(bars.length - 1, 1)) * 0.6;
        return (
          <div
            key={i}
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "flex-end",
              gap: 4,
            }}
          >
            <div
              style={{
                fontFamily: "var(--mono)",
                fontSize: "var(--fs-2xs)",
                color: "var(--text-tertiary)",
              }}
            >
              {fmt(b.value)}
            </div>
            <div
              style={{
                width: "100%",
                height: Math.max(fillHeight, 2),
                background: color,
                opacity,
                borderRadius: "var(--radius-sm) var(--radius-sm) 0 0",
              }}
            />
            <div
              style={{
                fontSize: "var(--fs-2xs)",
                color: "var(--text-tertiary)",
                textTransform: "uppercase",
                letterSpacing: ".04em",
              }}
            >
              {b.label}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function fmt(n: number): string {
  if (Math.abs(n) >= 1000) return (n / 1000).toFixed(1) + "K";
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}
