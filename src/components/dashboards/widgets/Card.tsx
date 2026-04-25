import type { CSSProperties, ReactNode } from "react";
import { ds } from "./style";

export interface CardProps {
  children: ReactNode;
  padding?: number;
  elevated?: boolean;
  style?: CSSProperties;
}

export function Card({ children, padding = 16, elevated = false, style }: CardProps) {
  const base = elevated ? ds.cardElevated : ds.card;
  return <div style={{ ...base, padding, ...style }}>{children}</div>;
}
