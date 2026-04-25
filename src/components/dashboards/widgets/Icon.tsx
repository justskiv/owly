import { LucideIconByName } from "../LucideIconByName";

export interface IconProps {
  name: string;
  size?: number;
  strokeWidth?: number;
}

// Lets dashboards use Lucide icons inline (`<widgets.Icon name="target" />`)
// instead of being limited to emoji. Same name set as the registry
// card icons; unknown names fall back to bar-chart.
export function Icon({ name, size = 18, strokeWidth = 1.5 }: IconProps) {
  return <LucideIconByName name={name} size={size} strokeWidth={strokeWidth} />;
}
