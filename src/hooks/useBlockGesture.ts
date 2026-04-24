import { useCallback, useEffect, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import type { Block, Entity } from "../schemas";
import { toast } from "../components/shared/Toast";
import { useScheduleStore } from "../store/schedule";
import { useUIStore } from "../store/ui";
import {
  DEFAULT_BLOCK_DURATION_MIN,
  END_HOUR,
  MIN_BLOCK_MIN,
  ROW_H,
  SNAP_MIN,
  START_HOUR,
  fmtDur,
  minutesToTime,
  timeToMinutes,
  yToMin,
} from "../services/time-utils";
import { pickCategory } from "../services/categories";

// Pool ghost has no parent column, so it can't take the day-column
// width. Mirrors mock line 674 — wide enough to show title+meta,
// narrow enough not to cover a whole column on drop preview.
const POOL_GHOST_WIDTH = 140;

export interface DropTarget {
  date: string;
  minute: number;
  duration: number;
}

export interface ResizeState {
  blockId: string;
  duration: number;
  tipX: number;
  tipY: number;
}

type GestureKind = "drag" | "resize" | "pool-drag";

interface Active {
  // For pool-drag, blockId/block/originalDuration/pendingResize are
  // unused — the entity is the source and addBlock creates a fresh
  // one. For drag/resize, entity is unused.
  blockId: string | null;
  block: Block | null;
  entity: Entity | null;
  kind: GestureKind;
  el: HTMLElement;
  pointerId: number;
  startX: number;
  startY: number;
  grabOffX: number;
  grabOffY: number;
  rectWidth: number;
  rectHeight: number;
  originalDuration: number;
  moved: boolean;
  ghost: HTMLDivElement | null;
  pendingDrop: { date: string; minute: number } | null;
  pendingResize: number | null;
  onMove: (e: PointerEvent) => void;
  onUp: (e: PointerEvent) => void;
  onCancel: (e: PointerEvent) => void;
  onBlur: () => void;
  onScroll: () => void;
}

const RESIZE_HIT_PX = 10;
const DRAG_THRESHOLD_PX = 5;

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => {
    switch (c) {
      case "&":
        return "&amp;";
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case '"':
        return "&quot;";
      case "'":
        return "&#39;";
      default:
        return c;
    }
  });
}

function findDropTarget(
  cursorX: number,
  topY: number,
  duration: number,
): { date: string; minute: number } | null {
  // Mirrors mock getDropTarget: column chosen by cursor X, minute by
  // the Y of the block's would-be top edge. getBoundingClientRect
  // already accounts for scroll — do NOT subtract scrollTop.
  const cols = document.querySelectorAll<HTMLElement>(".day-col");
  for (const col of cols) {
    const r = col.getBoundingClientRect();
    if (cursorX < r.left || cursorX > r.right) continue;
    const date = col.dataset.date;
    if (!date) continue;
    const relY = topY - r.top;
    const min = yToMin(relY, SNAP_MIN);
    // Top must be inside grid AND the whole block must fit before
    // END_HOUR — otherwise the block wraps past midnight.
    if (min < START_HOUR * 60) return null;
    if (min + duration > END_HOUR * 60) return null;
    return { date, minute: min };
  }
  return null;
}

export function useBlockGesture() {
  // Split state so the .dragging visual stays on while the cursor
  // is temporarily out of a valid drop slot (dropTarget = null).
  const [activeDragBlockId, setActiveDragBlockId] = useState<string | null>(
    null,
  );
  const [dropTarget, setDropTarget] = useState<DropTarget | null>(null);
  const [resizeState, setResizeState] = useState<ResizeState | null>(null);
  const [gesturing, setGesturing] = useState(false);
  const activeRef = useRef<Active | null>(null);
  const lastCursorRef = useRef<{ x: number; y: number } | null>(null);

  const teardown = useCallback(
    (commit: "move" | "resize" | "select" | "cancel" | "pool-drop") => {
      const a = activeRef.current;
      if (!a) return;

      window.removeEventListener("pointermove", a.onMove);
      window.removeEventListener("pointerup", a.onUp);
      window.removeEventListener("pointercancel", a.onCancel);
      window.removeEventListener("lostpointercapture", a.onCancel);
      window.removeEventListener("blur", a.onBlur);
      document.removeEventListener("scroll", a.onScroll, true);

      try {
        if (a.el.isConnected && a.el.hasPointerCapture?.(a.pointerId)) {
          a.el.releasePointerCapture(a.pointerId);
        }
      } catch {
        // ignore
      }

      const {
        block,
        entity,
        pendingDrop,
        pendingResize,
        originalDuration,
        ghost,
        el,
      } = a;
      lastCursorRef.current = null;

      // activeRef/gesturing stay live until any in-flight store write
      // settles. Without that, a second pointerdown on the same pool
      // item (or block) could sneak past the activeRef guard while
      // addBlock/moveBlock is still awaiting disk I/O — producing a
      // duplicate block or racing two writes.
      const releaseActive = () => {
        if (activeRef.current === a) {
          activeRef.current = null;
          setGesturing(false);
        }
      };

      const clearPoolSource = () => {
        if (entity) {
          el.classList.remove("dragging-source");
        }
      };

      // Sync branches remove ghost immediately.
      if (commit === "select") {
        if (ghost) ghost.remove();
        clearPoolSource();
        setActiveDragBlockId(null);
        setDropTarget(null);
        setResizeState(null);
        if (block) useUIStore.getState().setSelectedBlock(block.id);
        releaseActive();
        return;
      }
      if (commit === "cancel") {
        if (ghost) ghost.remove();
        clearPoolSource();
        setActiveDragBlockId(null);
        setDropTarget(null);
        setResizeState(null);
        releaseActive();
        return;
      }
      if (commit === "move") {
        if (!block) {
          releaseActive();
          return;
        }
        if (!pendingDrop) {
          if (ghost) ghost.remove();
          setActiveDragBlockId(null);
          setDropTarget(null);
          releaseActive();
          return;
        }
        const sameSlot =
          block.date === pendingDrop.date &&
          timeToMinutes(block.start) === pendingDrop.minute;
        if (sameSlot) {
          if (ghost) ghost.remove();
          setActiveDragBlockId(null);
          setDropTarget(null);
          releaseActive();
          return;
        }
        // Keep ghost + .dragging state until the store update settles.
        // React 18 batches set() with the cleanup below, so the block
        // re-renders at its new slot in the same paint tick — ghost
        // acts as a placeholder, no flash, no teleport gap.
        void (async () => {
          try {
            await useScheduleStore
              .getState()
              .moveBlock(
                block.id,
                pendingDrop.date,
                minutesToTime(pendingDrop.minute),
              );
          } catch (e) {
            toast.error(`Не удалось: ${(e as Error).message}`);
          } finally {
            if (ghost) ghost.remove();
            setActiveDragBlockId(null);
            setDropTarget(null);
            releaseActive();
          }
        })();
        return;
      }
      if (commit === "resize") {
        if (!block) {
          releaseActive();
          return;
        }
        if (
          pendingResize != null &&
          pendingResize !== originalDuration
        ) {
          void (async () => {
            try {
              await useScheduleStore
                .getState()
                .resizeBlock(block.id, pendingResize);
            } catch (e) {
              toast.error(`Не удалось: ${(e as Error).message}`);
            } finally {
              setResizeState(null);
              releaseActive();
            }
          })();
          return;
        }
        setResizeState(null);
        releaseActive();
        return;
      }
      if (commit === "pool-drop") {
        if (!entity || !pendingDrop) {
          if (ghost) ghost.remove();
          clearPoolSource();
          setDropTarget(null);
          releaseActive();
          return;
        }
        // Pool drop is additive — no placeholder swap needed. Clear
        // visuals before the await so the snap-preview doesn't linger
        // on top of the freshly rendered block.
        if (ghost) ghost.remove();
        clearPoolSource();
        setDropTarget(null);
        const duration =
          entity.estimated_minutes ?? DEFAULT_BLOCK_DURATION_MIN;
        const category = pickCategory(entity.tags);
        void (async () => {
          try {
            await useScheduleStore.getState().addBlock({
              title: entity.title,
              date: pendingDrop.date,
              start: minutesToTime(pendingDrop.minute),
              duration,
              category,
              status: "planned",
              notes: "",
              source_entity_id: entity.id,
            });
          } catch (e) {
            toast.error(`Не удалось: ${(e as Error).message}`);
          } finally {
            releaseActive();
          }
        })();
        return;
      }
    },
    [],
  );

  const onBlockPointerDown = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>, block: Block) => {
      if (e.button !== 0) return;
      if (activeRef.current) return;

      const el = e.currentTarget;
      const rect = el.getBoundingClientRect();
      // Resize handle wins whenever the pointer is on .rh (target-based
      // check is exact even when CSS borders shift the coord by 1px).
      const evTarget = e.target as HTMLElement | null;
      const onHandle = !!(evTarget && evTarget.closest(".rh"));
      const isResize =
        onHandle || e.clientY > rect.bottom - RESIZE_HIT_PX;
      const pointerId = e.pointerId;

      // preventDefault blocks native text-selection drag (the mock
      // does the same — line 599). dblclick fires from pointerup
      // pairs and stays unaffected in modern engines.
      e.preventDefault();
      e.stopPropagation();

      try {
        if (el.isConnected) el.setPointerCapture(pointerId);
      } catch {
        // WKWebView / older engines may reject; keep going
      }

      const a: Active = {
        blockId: block.id,
        block,
        entity: null,
        kind: isResize ? "resize" : "drag",
        el,
        pointerId,
        startX: e.clientX,
        startY: e.clientY,
        grabOffX: e.clientX - rect.left,
        grabOffY: e.clientY - rect.top,
        rectWidth: rect.width,
        rectHeight: rect.height,
        originalDuration: block.duration,
        moved: false,
        ghost: null,
        pendingDrop: null,
        pendingResize: null,
        onMove: () => {},
        onUp: () => {},
        onCancel: () => {},
        onBlur: () => {},
        onScroll: () => {},
      };

      const recomputeDropTarget = (cx: number, cy: number) => {
        const topY = cy - a.grabOffY;
        const target = findDropTarget(cx, topY, block.duration);
        if (target) {
          a.pendingDrop = target;
          setDropTarget({
            date: target.date,
            minute: target.minute,
            duration: block.duration,
          });
        } else {
          a.pendingDrop = null;
          setDropTarget(null);
        }
      };

      const onMove = (ev: PointerEvent) => {
        if (ev.pointerId !== a.pointerId) return;
        const dx = ev.clientX - a.startX;
        const dy = ev.clientY - a.startY;
        if (
          !a.moved &&
          Math.abs(dx) < DRAG_THRESHOLD_PX &&
          Math.abs(dy) < DRAG_THRESHOLD_PX
        ) {
          return;
        }
        a.moved = true;
        lastCursorRef.current = { x: ev.clientX, y: ev.clientY };

        if (a.kind === "resize") {
          const startMin = timeToMinutes(block.start);
          const maxDur = END_HOUR * 60 - startMin;
          const raw =
            Math.round(
              (a.originalDuration + (dy / ROW_H) * 30) / SNAP_MIN,
            ) * SNAP_MIN;
          const newDur = Math.min(maxDur, Math.max(MIN_BLOCK_MIN, raw));
          a.pendingResize = newDur;
          setResizeState({
            blockId: block.id,
            duration: newDur,
            tipX: ev.clientX,
            tipY: ev.clientY,
          });
          return;
        }

        // drag branch
        if (!a.ghost) {
          const g = document.createElement("div");
          g.className = `drag-ghost tb ${block.category}`;
          g.style.width = a.rectWidth + "px";
          g.style.height = a.rectHeight + "px";
          g.innerHTML =
            `<div class="bt">${escapeHtml(block.title)}</div>` +
            `<div class="bm">${fmtDur(block.duration)}</div>`;
          document.body.appendChild(g);
          a.ghost = g;
          setActiveDragBlockId(block.id);
        }
        // Synchronous ghost follow — that's the "airy" feel from the
        // mock. No React batching between pointermove and paint.
        a.ghost.style.left = ev.clientX - a.grabOffX + "px";
        a.ghost.style.top = ev.clientY - a.grabOffY + "px";

        recomputeDropTarget(ev.clientX, ev.clientY);
      };

      const onUp = (ev: PointerEvent) => {
        if (ev.pointerId !== a.pointerId) return;
        if (!a.moved) {
          teardown("select");
          return;
        }
        teardown(a.kind === "resize" ? "resize" : "move");
      };

      const onCancel = (ev: PointerEvent) => {
        // A secondary pointer (e.g. second touch) must not kill the
        // primary gesture.
        if (ev.pointerId !== a.pointerId) return;
        teardown("cancel");
      };
      const onBlur = () => teardown("cancel");

      // Scroll during drag: pointermove doesn't fire on wheel/trackpad
      // scroll, but the columns shifted under the (fixed-position)
      // ghost. Recompute drop target from the last known cursor.
      const onScroll = () => {
        if (a.kind !== "drag") return;
        const c = lastCursorRef.current;
        if (!c) return;
        recomputeDropTarget(c.x, c.y);
      };

      a.onMove = onMove;
      a.onUp = onUp;
      a.onCancel = onCancel;
      a.onBlur = onBlur;
      a.onScroll = onScroll;
      activeRef.current = a;
      setGesturing(true);

      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
      window.addEventListener("pointercancel", onCancel);
      window.addEventListener("lostpointercapture", onCancel);
      window.addEventListener("blur", onBlur);
      // Capture-phase to catch scroll on .grid-scroll (scroll events
      // don't bubble).
      document.addEventListener("scroll", onScroll, true);
    },
    [teardown],
  );

  const onPoolItemPointerDown = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>, entity: Entity) => {
      if (e.button !== 0) return;
      if (activeRef.current) return;

      const el = e.currentTarget;
      const rect = el.getBoundingClientRect();
      const pointerId = e.pointerId;
      const duration = entity.estimated_minutes ?? DEFAULT_BLOCK_DURATION_MIN;
      const category = pickCategory(entity.tags);
      const ghostHeight = (duration / 30) * ROW_H;

      // preventDefault blocks native text-selection on .pi-t /.pi-m.
      e.preventDefault();
      e.stopPropagation();

      try {
        if (el.isConnected) el.setPointerCapture(pointerId);
      } catch {
        // ignore
      }

      const a: Active = {
        blockId: null,
        block: null,
        entity,
        kind: "pool-drag",
        el,
        pointerId,
        startX: e.clientX,
        startY: e.clientY,
        // Ghost is 140px wide but the source .pi can be wider — anchor
        // ghost so grab point lines up with cursor's X-offset inside
        // the original card, clamped to ghost width.
        grabOffX: Math.min(e.clientX - rect.left, POOL_GHOST_WIDTH - 10),
        grabOffY: Math.min(e.clientY - rect.top, ghostHeight - 10),
        rectWidth: POOL_GHOST_WIDTH,
        rectHeight: ghostHeight,
        originalDuration: duration,
        moved: false,
        ghost: null,
        pendingDrop: null,
        pendingResize: null,
        onMove: () => {},
        onUp: () => {},
        onCancel: () => {},
        onBlur: () => {},
        onScroll: () => {},
      };

      const recomputeDropTarget = (cx: number, cy: number) => {
        const topY = cy - a.grabOffY;
        const target = findDropTarget(cx, topY, duration);
        if (target) {
          a.pendingDrop = target;
          setDropTarget({
            date: target.date,
            minute: target.minute,
            duration,
          });
        } else {
          a.pendingDrop = null;
          setDropTarget(null);
        }
      };

      const onMove = (ev: PointerEvent) => {
        if (ev.pointerId !== a.pointerId) return;
        const dx = ev.clientX - a.startX;
        const dy = ev.clientY - a.startY;
        if (
          !a.moved &&
          Math.abs(dx) < DRAG_THRESHOLD_PX &&
          Math.abs(dy) < DRAG_THRESHOLD_PX
        ) {
          return;
        }
        a.moved = true;
        lastCursorRef.current = { x: ev.clientX, y: ev.clientY };

        if (!a.ghost) {
          const g = document.createElement("div");
          g.className = `drag-ghost tb ${category}`;
          g.style.width = POOL_GHOST_WIDTH + "px";
          g.style.height = ghostHeight + "px";
          g.innerHTML =
            `<div class="bt">${escapeHtml(entity.title)}</div>` +
            `<div class="bm">${fmtDur(duration)}</div>`;
          document.body.appendChild(g);
          a.ghost = g;
          el.classList.add("dragging-source");
        }
        a.ghost.style.left = ev.clientX - a.grabOffX + "px";
        a.ghost.style.top = ev.clientY - a.grabOffY + "px";

        recomputeDropTarget(ev.clientX, ev.clientY);
      };

      const onUp = (ev: PointerEvent) => {
        if (ev.pointerId !== a.pointerId) return;
        // No movement → click on a pool item does nothing; the entity
        // editor lands in Phase 4.
        if (!a.moved) {
          teardown("cancel");
          return;
        }
        teardown("pool-drop");
      };

      const onCancel = (ev: PointerEvent) => {
        if (ev.pointerId !== a.pointerId) return;
        teardown("cancel");
      };
      const onBlur = () => teardown("cancel");
      const onScroll = () => {
        const c = lastCursorRef.current;
        if (!c) return;
        recomputeDropTarget(c.x, c.y);
      };

      a.onMove = onMove;
      a.onUp = onUp;
      a.onCancel = onCancel;
      a.onBlur = onBlur;
      a.onScroll = onScroll;
      activeRef.current = a;
      setGesturing(true);

      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
      window.addEventListener("pointercancel", onCancel);
      window.addEventListener("lostpointercapture", onCancel);
      window.addEventListener("blur", onBlur);
      document.addEventListener("scroll", onScroll, true);
    },
    [teardown],
  );

  const cancelGesture = useCallback(() => {
    if (activeRef.current) teardown("cancel");
  }, [teardown]);

  useEffect(() => {
    return () => {
      if (activeRef.current) teardown("cancel");
    };
  }, [teardown]);

  return {
    activeDragBlockId,
    dropTarget,
    resizeState,
    gesturing,
    onBlockPointerDown,
    onPoolItemPointerDown,
    cancelGesture,
  };
}
