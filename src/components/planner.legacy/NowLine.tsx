// LEGACY — phase 6 backup, removed in phase 9
import { minToY } from "../../services/time-utils";

interface NowLineProps {
  minutes: number;
}

export function NowLine({ minutes }: NowLineProps) {
  return (
    <div
      className="now-line"
      style={{ top: minToY(minutes) }}
      aria-hidden="true"
    />
  );
}
