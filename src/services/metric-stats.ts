import type { MetricHistoryItem } from "../schemas";

export interface MetricStats {
  change: number; // last - prev
  changePct: number; // 0 if prev is 0
  avgGrowth: number; // mean per-step delta over the series
  trend: "up" | "down" | "flat";
  // Bars for 6-month bar chart; last-of-month aggregation. If history
  // spans fewer than 6 months the earlier slots simply don't appear.
  bars: { label: string; value: number }[];
  sparkline: number[];
}

const MONTHS_RU = [
  "Янв",
  "Фев",
  "Мар",
  "Апр",
  "Май",
  "Июн",
  "Июл",
  "Авг",
  "Сен",
  "Окт",
  "Ноя",
  "Дек",
];

function ymKey(iso: string): string {
  return iso.slice(0, 7); // YYYY-MM
}

function monthLabel(iso: string): string {
  const m = parseInt(iso.slice(5, 7), 10) - 1;
  return MONTHS_RU[m] ?? "";
}

export function computeMetricStats(
  history: readonly MetricHistoryItem[],
): MetricStats {
  if (history.length === 0) {
    return {
      change: 0,
      changePct: 0,
      avgGrowth: 0,
      trend: "flat",
      bars: [],
      sparkline: [],
    };
  }
  // Stable tri-state comparator so history points with identical
  // dates keep insertion order instead of relying on engine quirks.
  const sorted = [...history].sort((a, b) =>
    a.date < b.date ? -1 : a.date > b.date ? 1 : 0,
  );
  const values = sorted.map((h) => h.value);
  const last = values[values.length - 1];
  const prev = values.length > 1 ? values[values.length - 2] : last;
  const change = last - prev;
  const changePct = prev !== 0 ? (change / prev) * 100 : 0;

  const totalDelta = last - values[0];
  const avgGrowth = values.length > 1 ? totalDelta / (values.length - 1) : 0;

  const trend: MetricStats["trend"] =
    Math.abs(change) < 1e-9 ? "flat" : change > 0 ? "up" : "down";

  // Last-of-month aggregation: keep only the final point per YYYY-MM,
  // then take the last 6.
  const lastByMonth = new Map<string, MetricHistoryItem>();
  for (const h of sorted) lastByMonth.set(ymKey(h.date), h);
  const monthly = [...lastByMonth.values()].slice(-6);
  const bars = monthly.map((h) => ({
    label: monthLabel(h.date),
    value: h.value,
  }));

  return {
    change,
    changePct,
    avgGrowth,
    trend,
    bars,
    sparkline: values,
  };
}
