import { useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  useUIStore,
  type EntityPopupAnchor,
} from "../../store/ui";
import { useEntityStore } from "../../store/entities";
import { useEscape } from "../../hooks/useEscape";
import { TaskPopup } from "../entities/popup/TaskPopup";

interface EntityPopupProps {
  anchor: EntityPopupAnchor;
  position: "below" | "right";
  onClose: () => void;
  children: React.ReactNode;
}

const VIEWPORT_MARGIN = 8;
const ANCHOR_GAP_BELOW = 4;
const ANCHOR_GAP_RIGHT = 8;

export function EntityPopup({
  anchor,
  position,
  onClose,
  children,
}: EntityPopupProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(
    null,
  );
  // Two-pass layout: render hidden first to measure own size, then
  // compute position with flip + clamp. Without measuring we cannot
  // know whether `below` overflows the viewport bottom.
  useLayoutEffect(() => {
    if (!ref.current) return;
    const popup = ref.current.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    let top: number;
    let left: number;
    if (anchor.type === "rect") {
      const a = anchor.rect;
      if (position === "below") {
        top = a.bottom + ANCHOR_GAP_BELOW;
        left = a.left;
        if (top + popup.height > vh - VIEWPORT_MARGIN) {
          top = a.top - popup.height - ANCHOR_GAP_BELOW;
        }
      } else {
        top = a.top;
        left = a.right + ANCHOR_GAP_RIGHT;
        if (left + popup.width > vw - VIEWPORT_MARGIN) {
          left = a.left - popup.width - ANCHOR_GAP_RIGHT;
        }
      }
    } else {
      top = anchor.y;
      left = anchor.x;
    }
    top = Math.max(
      VIEWPORT_MARGIN,
      Math.min(top, vh - popup.height - VIEWPORT_MARGIN),
    );
    left = Math.max(
      VIEWPORT_MARGIN,
      Math.min(left, vw - popup.width - VIEWPORT_MARGIN),
    );
    setCoords({ top, left });
  }, [anchor, position]);

  useEscape(onClose);

  // Click-outside listener installs on the next tick so the click that
  // *opened* the popup does not immediately close it. Sub-popovers
  // (e.g. the deadline picker portalled to body) whitelist themselves
  // via `.ep-subpopover` so clicking inside one keeps the popup open.
  useEffect(() => {
    let detach: (() => void) | undefined;
    const id = window.setTimeout(() => {
      const handler = (e: MouseEvent) => {
        const target = e.target as Element | null;
        if (!target) return;
        if (ref.current?.contains(target as Node)) return;
        if (target.closest?.(".ep-subpopover")) return;
        onClose();
      };
      document.addEventListener("mousedown", handler);
      detach = () => document.removeEventListener("mousedown", handler);
    }, 50);
    return () => {
      window.clearTimeout(id);
      detach?.();
    };
  }, [onClose]);

  return (
    <div
      ref={ref}
      className="entity-popup"
      role="dialog"
      style={
        coords
          ? { top: coords.top, left: coords.left }
          : { top: 0, left: 0, visibility: "hidden" }
      }
    >
      {children}
    </div>
  );
}

export function EntityPopupHost() {
  const state = useUIStore((s) => s.entityPopup);
  const close = useUIStore((s) => s.closeEntityPopup);
  if (!state.open) return null;
  return (
    <EntityPopup
      anchor={state.anchor}
      position={state.position}
      onClose={close}
    >
      <EntityPopupContent entityId={state.entityId} onClose={close} />
    </EntityPopup>
  );
}

function EntityPopupContent({
  entityId,
  onClose,
}: {
  entityId: string;
  onClose: () => void;
}) {
  const entity = useEntityStore((s) =>
    s.entities.find((e) => e.id === entityId),
  );
  if (!entity) {
    return (
      <div className="ep-stub">
        <button
          type="button"
          className="ep-close"
          onClick={onClose}
          aria-label="Закрыть"
        >
          ×
        </button>
        <div className="ep-hint">Сущность не найдена</div>
      </div>
    );
  }
  if (entity.type === "task") {
    return <TaskPopup task={entity} onClose={onClose} />;
  }
  return (
    <div className="ep-stub">
      <button
        type="button"
        className="ep-close"
        onClick={onClose}
        aria-label="Закрыть"
      >
        ×
      </button>
      <div className="ep-title">{entity.title}</div>
      <div className="ep-hint">
        Phase {entity.type === "project" ? 4 : 5} наполнит для {entity.type}
      </div>
    </div>
  );
}
