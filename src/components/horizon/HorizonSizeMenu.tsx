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

  useEffect(() => {
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
      {SIZES.map((s) => (
        <button
          key={s.id}
          type="button"
          role="menuitem"
          onClick={() => onSelect(s.id)}
        >
          <span>{s.label}</span>
          {active === s.id && <span className="hz-size-check">✓</span>}
        </button>
      ))}
    </div>
  );
}
