import { useEffect, useRef } from "react";
import {
  DEFAULT_BLOCK_DURATION_MIN,
  ROW_H,
  minToY,
} from "../../services/time-utils";

interface InlineCreateProps {
  minute: number;
  onCancel: () => void;
  onSubmit: (title: string) => void;
}

export function InlineCreate({
  minute,
  onCancel,
  onSubmit,
}: InlineCreateProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus({ preventScroll: true });
  }, []);

  return (
    <div
      className="inline-block"
      style={{
        top: minToY(minute),
        height: (DEFAULT_BLOCK_DURATION_MIN / 30) * ROW_H,
      }}
    >
      <input
        ref={inputRef}
        className="inline-input"
        placeholder="Название..."
        aria-label="Название нового блока"
        onMouseDown={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            const value = e.currentTarget.value.trim();
            if (value) {
              e.preventDefault();
              onSubmit(value);
            }
          }
          if (e.key === "Escape") {
            // Hand focus off to body BEFORE React unmounts the node.
            // Otherwise WebKit's scroll-anchoring algorithm picks a
            // new anchor (the now-line or next block) when the focused
            // absolute-positioned input vanishes from the scroller,
            // and re-aligns scrollTop to keep that anchor stable —
            // which presents as a sudden jump.
            e.preventDefault();
            e.stopPropagation();
            e.currentTarget.blur();
            onCancel();
          }
        }}
      />
    </div>
  );
}
