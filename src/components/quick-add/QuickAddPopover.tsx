import { useEffect, useMemo, useRef } from "react";
import { useUIStore } from "../../store/ui";
import { buildPopoverItems } from "../../services/quick-add-popover-items";
import { getStartOfDay } from "../../services/time-utils";

const AUTO_CLOSE_DELAY_MS = 200;

export function QuickAddPopover() {
  const filter = useUIStore((s) => s.quickAdd.popoverFilter);
  const selectedIndex = useUIStore((s) => s.quickAdd.popoverSelectedIndex);
  const setSelectedIndex = useUIStore((s) => s.setPopoverSelectedIndex);
  const closePopover = useUIStore((s) => s.closePopover);
  const applyItem = useUIStore((s) => s.applyPopoverItem);

  // Compute on each render so the popover's relative labels stay
  // correct across midnight rollovers while the overlay stays open.
  const baseDate = getStartOfDay();
  // baseDate changes value only at midnight; intentionally not
  // memoized so labels stay fresh while we still memoize on the
  // user-driven `filter`.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const items = useMemo(() => buildPopoverItems(filter, baseDate), [filter]);
  const selectedRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (items.length === 0) {
      const t = window.setTimeout(closePopover, AUTO_CLOSE_DELAY_MS);
      return () => window.clearTimeout(t);
    }
  }, [items.length, closePopover]);

  useEffect(() => {
    selectedRef.current?.scrollIntoView({ block: "nearest" });
  }, [selectedIndex]);

  if (items.length === 0) return null;

  return (
    <div className="qa-popover" role="listbox">
      {items.map((it, idx) => {
        const active = idx === selectedIndex;
        return (
          <button
            key={it.key}
            ref={active ? selectedRef : undefined}
            type="button"
            className={`qa-popover-item${active ? " on" : ""}`}
            role="option"
            aria-selected={active}
            onMouseEnter={() => setSelectedIndex(idx)}
            onClick={() => {
              setSelectedIndex(idx);
              applyItem();
            }}
          >
            <span className="qa-popover-item-label">{it.label}</span>
            {it.secondary && (
              <span className="qa-popover-item-secondary">{it.secondary}</span>
            )}
          </button>
        );
      })}
      <div className="qa-popover-hint">
        <span className="qa-kbd">!2026-12-31</span> ISO ·{" "}
        <span className="qa-kbd">!15.05</span> DD.MM
      </div>
    </div>
  );
}
