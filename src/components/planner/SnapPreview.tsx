import { ROW_H, minToY } from "../../services/time-utils";

interface SnapPreviewProps {
  minute: number;
  duration: number;
}

export function SnapPreview({ minute, duration }: SnapPreviewProps) {
  return (
    <div
      className="snap-preview"
      style={{
        top: minToY(minute),
        height: (duration / 30) * ROW_H,
      }}
      aria-hidden="true"
    />
  );
}
