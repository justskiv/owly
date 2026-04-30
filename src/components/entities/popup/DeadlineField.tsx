import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { useEscape } from "../../../hooks/useEscape";
import {
  DeadlinePicker,
  formatDeadlinePill,
} from "./DeadlinePicker";

interface DeadlineFieldProps {
  value: string | null;
  onChange: (iso: string | null) => void;
}

const VIEWPORT_MARGIN = 8;
const GAP = 6;

type Placement = "right" | "below" | "above" | "left";

interface PopoverCoords {
  top: number;
  left: number;
  placement: Placement;
}

export function DeadlineField({ value, onChange }: DeadlineFieldProps) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const [coords, setCoords] = useState<PopoverCoords | null>(null);
  const [viewportKey, setViewportKey] = useState(0);

  useEffect(() => {
    if (!open) return;
    const onResize = () => setViewportKey((k) => k + 1);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [open]);

  // Two-pass placement: render the popover hidden, measure, then place
  // with flip preference right → below → above → left. Tries each
  // candidate against the viewport and picks the first that fits.
  useLayoutEffect(() => {
    if (!open || !triggerRef.current || !popoverRef.current) return;
    const t = triggerRef.current.getBoundingClientRect();
    const p = popoverRef.current.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    const candidates: Array<{ p: Placement; top: number; left: number }> = [
      { p: "right", top: t.top, left: t.right + GAP },
      { p: "below", top: t.bottom + GAP, left: t.left },
      { p: "above", top: t.top - p.height - GAP, left: t.left },
      { p: "left", top: t.top, left: t.left - p.width - GAP },
    ];
    const fits = (top: number, left: number) =>
      top >= VIEWPORT_MARGIN &&
      left >= VIEWPORT_MARGIN &&
      top + p.height <= vh - VIEWPORT_MARGIN &&
      left + p.width <= vw - VIEWPORT_MARGIN;
    let chosen = candidates.find((c) => fits(c.top, c.left)) ?? candidates[0];

    const top = Math.max(
      VIEWPORT_MARGIN,
      Math.min(chosen.top, vh - p.height - VIEWPORT_MARGIN),
    );
    const left = Math.max(
      VIEWPORT_MARGIN,
      Math.min(chosen.left, vw - p.width - VIEWPORT_MARGIN),
    );
    setCoords({ top, left, placement: chosen.p });
  }, [open, value, viewportKey]);

  // Outside-click on the picker only — closes the picker, not the
  // entity popup. Trigger pill is whitelisted so re-clicking it
  // doesn't immediately reopen.
  useEffect(() => {
    if (!open) return;
    const handler = (e: globalThis.MouseEvent) => {
      const target = e.target as Node | null;
      if (!target) return;
      if (popoverRef.current?.contains(target)) return;
      if (triggerRef.current?.contains(target)) return;
      setOpen(false);
    };
    const id = window.setTimeout(() => {
      document.addEventListener("mousedown", handler);
    }, 50);
    return () => {
      window.clearTimeout(id);
      document.removeEventListener("mousedown", handler);
    };
  }, [open]);

  useEscape(() => setOpen(false), open);

  return (
    <>
      {value ? (
        <div className="ep-dl-pill">
          <button
            ref={triggerRef}
            type="button"
            className="ep-dl-pill-label"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-haspopup="dialog"
          >
            {formatDeadlinePill(value)}
          </button>
          <button
            type="button"
            className="ep-dl-pill-clear"
            onClick={() => onChange(null)}
            aria-label="Убрать дедлайн"
          >
            ×
          </button>
        </div>
      ) : (
        <button
          ref={triggerRef}
          type="button"
          className="ep-dl-add"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-haspopup="dialog"
        >
          Без дедлайна
        </button>
      )}
      {open &&
        createPortal(
          <div
            ref={popoverRef}
            className="ep-subpopover ep-dl-popover"
            role="dialog"
            aria-label="Выбор дедлайна"
            style={
              coords
                ? { top: coords.top, left: coords.left }
                : { top: 0, left: 0, visibility: "hidden" }
            }
          >
            <DeadlinePicker
              value={value}
              onChange={onChange}
              onClose={() => setOpen(false)}
            />
          </div>,
          document.body,
        )}
    </>
  );
}
