import { useEffect, useRef } from "react";
import type { HorizonSize } from "../../schemas";

interface Props {
  active: HorizonSize;
  onSelect: (size: HorizonSize) => void;
  onClose: () => void;
}

const SIZES: { id: HorizonSize; label: string }[] = [
  { id: "big", label: "Тяжёлый" },
  { id: "mid", label: "Средний" },
  { id: "small", label: "Мелкий" },
];

export function HorizonSizeMenu({ active, onSelect, onClose }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const activeBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    // Focus the currently-selected size on mount so keyboard users can
    // confirm with Enter or arrow-step into siblings via the browser's
    // default focus-ring traversal.
    activeBtnRef.current?.focus();

    const onAway = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("mousedown", onAway);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onAway);
      document.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  return (
    <div ref={ref} className="hz-size-menu" role="menu">
      {SIZES.map((s) => {
        const isActive = active === s.id;
        return (
          <button
            key={s.id}
            type="button"
            role="menuitemradio"
            aria-checked={isActive}
            ref={isActive ? activeBtnRef : null}
            onClick={() => onSelect(s.id)}
          >
            <span>{s.label}</span>
            {isActive && <span className="hz-size-check">✓</span>}
          </button>
        );
      })}
    </div>
  );
}
