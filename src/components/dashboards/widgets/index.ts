// Public widget API exposed to user-authored dashboards via props.
// This object is treated as a STABLE contract — adding a widget is
// fine, but renaming a prop or removing one is a breaking change for
// every existing .jsx in data/dashboards/. Keep that in mind before
// touching anything here.

import { Card } from "./Card";
import { Section } from "./Section";
import { KpiCard } from "./KpiCard";
import { Stat } from "./Stat";
import { StatRow } from "./StatRow";
import { ProgressBar } from "./ProgressBar";
import { Pill } from "./Pill";
import { Sparkline } from "./Sparkline";
import { BarChart } from "./BarChart";
import { EmptyState } from "./EmptyState";

export const DASHBOARD_WIDGETS = {
  Card,
  Section,
  KpiCard,
  Stat,
  StatRow,
  ProgressBar,
  Pill,
  Sparkline,
  BarChart,
  EmptyState,
} as const;

export type DashboardWidgets = typeof DASHBOARD_WIDGETS;

export { Card, Section, KpiCard, Stat, StatRow, ProgressBar, Pill, Sparkline, BarChart, EmptyState };
