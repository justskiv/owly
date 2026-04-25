import {
  BarChart3,
  Calendar,
  Database,
  Heart,
  LineChart,
  PieChart,
  Settings,
  Target,
  TrendingUp,
  Users,
  Zap,
  type LucideIcon,
} from "lucide-react";

const ICONS: Record<string, LucideIcon> = {
  "bar-chart": BarChart3,
  calendar: Calendar,
  database: Database,
  heart: Heart,
  "line-chart": LineChart,
  "pie-chart": PieChart,
  settings: Settings,
  target: Target,
  "trending-up": TrendingUp,
  users: Users,
  zap: Zap,
};

export function LucideIconByName({
  name,
  size = 22,
  strokeWidth = 1.5,
}: {
  name: string;
  size?: number;
  strokeWidth?: number;
}) {
  const Icon = ICONS[name.toLowerCase()] ?? BarChart3;
  return <Icon size={size} strokeWidth={strokeWidth} />;
}
