import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useEscape } from "../../hooks/useEscape";
import type { Area } from "../../schemas";

interface CatPickerPopupProps {
  anchor: { x: number; y: number };
  current: string | null;
  areas: readonly Area[];
  onSelect: (id: string) => void;
  onClose: () => void;
}

const VIEWPORT_MARGIN = 8;

export function CatPickerPopup({
  anchor,
  current,
  areas,
  onSelect,
  onClose,
}: CatPickerPopupProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(
    null,
  );
  const [viewportKey, setViewportKey] = useState(0);

  useEffect(() => {
    const onResize = () => setViewportKey((k) => k + 1);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useLayoutEffect(() => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const top = Math.max(
      VIEWPORT_MARGIN,
      Math.min(anchor.y, vh - rect.height - VIEWPORT_MARGIN),
    );
    const left = Math.max(
      VIEWPORT_MARGIN,
      Math.min(anchor.x, vw - rect.width - VIEWPORT_MARGIN),
    );
    setCoords({ top, left });
  }, [anchor, viewportKey]);

  useEscape(onClose);

  // Click-outside listener installs after a tick so the click that
  // opened the popup doesn't immediately close it.
  useEffect(() => {
    let detach: (() => void) | undefined;
    const id = window.setTimeout(() => {
      const handler = (e: MouseEvent) => {
        if (ref.current && !ref.current.contains(e.target as Node)) onClose();
      };
      document.addEventListener("mousedown", handler);
      detach = () => document.removeEventListener("mousedown", handler);
    }, 50);
    return () => {
      window.clearTimeout(id);
      detach?.();
    };
  }, [onClose]);

  return createPortal(
    <div
      ref={ref}
      className="cat-popup"
      role="listbox"
      style={
        coords
          ? { top: coords.top, left: coords.left }
          : { top: 0, left: 0, visibility: "hidden" }
      }
    >
      {areas.map((a) => (
        <button
          key={a.id}
          type="button"
          className={`cat-popup-item${current === a.id ? " active" : ""}`}
          role="option"
          aria-selected={current === a.id}
          onClick={() => {
            onSelect(a.id);
            onClose();
          }}
        >
          <span className="cat-popup-dot" style={{ background: a.color }} />
          <span>{a.label}</span>
        </button>
      ))}
    </div>,
    document.body,
  );
}
