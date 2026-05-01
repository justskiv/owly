import type { CSSProperties, MouseEvent, PointerEvent, ReactNode } from "react";

interface Props {
  color: string;
  title: string;
  meta?: ReactNode;
  bar?: { value: number; color: string };
  badge?: string;
  draggable?: boolean;
  placed?: boolean;
  done?: boolean;
  primaryAction?: {
    label: string;
    active?: boolean;
    onClick: () => void;
    title?: string;
  };
  secondaryAction?: {
    label: string;
    onClick: () => void;
    title?: string;
    variant?: "cad" | "del";
  };
  onPointerDown?: (e: PointerEvent<HTMLDivElement>) => void;
}

// Shared row used by all four Pool Sidebar tabs. The color stripe +
// title + meta + optional progress bar follows §4.6 «Shared Item
// Style». Two action slots cover «toggle pool» + «mark cadence»
// or «remove».
export function SItem({
  color,
  title,
  meta,
  bar,
  badge,
  draggable = false,
  placed = false,
  done = false,
  primaryAction,
  secondaryAction,
  onPointerDown,
}: Props) {
  const cls =
    "s-item" +
    (draggable && !placed ? " draggable" : "") +
    (placed ? " placed" : "") +
    (done ? " done-item" : "");
  const stop = (e: MouseEvent) => e.stopPropagation();
  const barStyle: CSSProperties | undefined = bar
    ? {
        width: `${Math.min(100, Math.max(0, bar.value * 100))}%`,
        background: bar.color,
      }
    : undefined;
  return (
    <div className={cls} onPointerDown={onPointerDown}>
      <div className="s-color" style={{ background: color }} />
      <div className="s-body">
        <div className="s-title">{title}</div>
        {meta && <div className="s-meta">{meta}</div>}
        {bar && (
          <div className="s-bar">
            <span style={barStyle} />
          </div>
        )}
      </div>
      {badge && <span className="s-badge">{badge}</span>}
      {secondaryAction && (
        <button
          type="button"
          className={`s-act${secondaryAction.variant ? " " + secondaryAction.variant : ""}`}
          onClick={(e) => {
            stop(e);
            secondaryAction.onClick();
          }}
          onPointerDown={stop}
          title={secondaryAction.title}
          aria-label={secondaryAction.title ?? secondaryAction.label}
        >
          {secondaryAction.label}
        </button>
      )}
      {primaryAction && (
        <button
          type="button"
          className={`s-act${primaryAction.active ? " in" : ""}`}
          onClick={(e) => {
            stop(e);
            primaryAction.onClick();
          }}
          onPointerDown={stop}
          title={primaryAction.title}
          aria-label={primaryAction.title ?? primaryAction.label}
        >
          {primaryAction.label}
        </button>
      )}
    </div>
  );
}
