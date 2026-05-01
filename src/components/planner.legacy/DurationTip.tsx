// LEGACY — phase 6 backup, removed in phase 9
import { createPortal } from "react-dom";
import { fmtDur } from "../../services/time-utils";

interface DurationTipProps {
  x: number;
  y: number;
  duration: number;
}

export function DurationTip({ x, y, duration }: DurationTipProps) {
  return createPortal(
    <div
      className="dur-tip"
      style={{ left: x + 12, top: y - 16 }}
      role="status"
      aria-live="polite"
    >
      {fmtDur(duration)}
    </div>,
    document.body,
  );
}
