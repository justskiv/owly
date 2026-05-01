import { ROW_H, START_HOUR } from "../../services/time-utils";

interface Props {
  minute: number;
}

export function DropIndicator({ minute }: Props) {
  const top = ((minute - START_HOUR * 60) / 30) * ROW_H;
  return <div className="drop-indicator" style={{ top }} />;
}
