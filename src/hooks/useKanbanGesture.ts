import { useCallback, useEffect, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import type { Area, ProjectEntity } from "../schemas";
import { useEntityStore } from "../store/entities";
import { pickAreaTag } from "../services/categories";
import { toast } from "../components/shared/Toast";

// Native HTML5 drag does not start reliably in this Tauri/WKWebView
// stack — body has `user-select: none`, the cards are generic divs,
// and even the WKWebView opt-ins (`-webkit-user-drag: element`) fail
// inconsistently. The planner already solved the same problem with
// pointer events + a manually-rendered ghost (see useBlockGesture);
// this hook is its sibling, scoped to kanban.

const DRAG_THRESHOLD_PX = 5;

interface KanbanDropTarget {
  columnIndex: number;
}

interface Active {
  project: ProjectEntity;
  el: HTMLElement;
  open: () => void;
  pointerId: number;
  startX: number;
  startY: number;
  grabOffX: number;
  grabOffY: number;
  rectWidth: number;
  rectHeight: number;
  ghostHTML: string;
  ghostCategory: string | null;
  moved: boolean;
  ghost: HTMLDivElement | null;
  pendingDrop: KanbanDropTarget | null;
  onMove: (e: PointerEvent) => void;
  onUp: (e: PointerEvent) => void;
  onCancel: (e: PointerEvent) => void;
  onBlur: () => void;
  onScroll: () => void;
}

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

function findKanbanDrop(x: number, y: number): KanbanDropTarget | null {
  const cols = document.querySelectorAll<HTMLElement>(".kanban-cards");
  for (const col of cols) {
    const r = col.getBoundingClientRect();
    if (x < r.left || x > r.right || y < r.top || y > r.bottom) continue;
    const raw = col.dataset.columnIndex;
    if (raw == null) continue;
    const idx = Number(raw);
    if (Number.isNaN(idx)) continue;
    return { columnIndex: idx };
  }
  return null;
}

export function useKanbanGesture(areas: readonly Area[]) {
  const [draggingProjectId, setDraggingProjectId] = useState<string | null>(
    null,
  );
  const [dropColumnIndex, setDropColumnIndex] = useState<number | null>(null);
  const activeRef = useRef<Active | null>(null);
  const lastCursorRef = useRef<{ x: number; y: number } | null>(null);

  const teardown = useCallback((commit: "drop" | "click" | "cancel") => {
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
      // Pointer capture release fails when the source element is gone
      // (component unmounted mid-gesture). Safe to ignore.
    }
    a.el.classList.remove("dragging-source");

    const ghost = a.ghost;
    const pending = a.pendingDrop;
    const project = a.project;
    const open = a.open;
    activeRef.current = null;

    if (commit === "click") {
      ghost?.remove();
      setDraggingProjectId(null);
      setDropColumnIndex(null);
      open();
      return;
    }

    if (
      commit === "cancel" ||
      !pending ||
      pending.columnIndex === project.fields.column_index
    ) {
      ghost?.remove();
      setDraggingProjectId(null);
      setDropColumnIndex(null);
      return;
    }

    // Persist-first: keep the ghost in the DOM until the store write
    // resolves so the moved card re-renders in its new column under
    // the still-visible ghost — no one-frame gap.
    void (async () => {
      try {
        await useEntityStore.getState().updateEntity(project.id, {
          fields: {
            ...project.fields,
            column_index: pending.columnIndex,
            last_activity_days: 0,
          },
        });
      } catch (e) {
        toast.error(`Не удалось переместить: ${(e as Error).message}`);
      } finally {
        ghost?.remove();
        setDraggingProjectId(null);
        setDropColumnIndex(null);
      }
    })();
  }, []);

  const onCardPointerDown = useCallback(
    (
      e: ReactPointerEvent<HTMLDivElement>,
      project: ProjectEntity,
      open: () => void,
    ) => {
      if (e.button !== 0) return;
      if (activeRef.current) return;

      const el = e.currentTarget;
      const rect = el.getBoundingClientRect();
      // preventDefault stops WKWebView starting a native text-selection
      // gesture, which would race with our pointer-tracking and silently
      // cancel the drag.
      e.preventDefault();
      try {
        el.setPointerCapture(e.pointerId);
      } catch {
        // Some WKWebView versions reject capture on already-captured
        // elements; tracking via window listeners still works.
      }

      const areaTag = pickAreaTag(project.tags, areas);

      const a: Active = {
        project,
        el,
        open,
        pointerId: e.pointerId,
        startX: e.clientX,
        startY: e.clientY,
        grabOffX: e.clientX - rect.left,
        grabOffY: e.clientY - rect.top,
        rectWidth: rect.width,
        rectHeight: rect.height,
        // Static HTML — using the original card's innerHTML would clone
        // the pool button (with its handlers) into the ghost, which is
        // confusing. A title-only ghost is enough visual feedback.
        ghostHTML: `<div class="kc-title">${escapeHtml(project.title)}</div>`,
        ghostCategory: areaTag,
        moved: false,
        ghost: null,
        pendingDrop: null,
        onMove: () => {},
        onUp: () => {},
        onCancel: () => {},
        onBlur: () => {},
        onScroll: () => {},
      };

      const recompute = (cx: number, cy: number) => {
        const t = findKanbanDrop(cx, cy);
        a.pendingDrop = t;
        setDropColumnIndex(t?.columnIndex ?? null);
      };

      a.onMove = (ev) => {
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
          const catClass = a.ghostCategory ? ` ${a.ghostCategory}` : "";
          g.className = `drag-ghost kanban-card-ghost${catClass}`;
          g.style.width = `${a.rectWidth}px`;
          g.innerHTML = a.ghostHTML;
          document.body.appendChild(g);
          a.ghost = g;
          a.el.classList.add("dragging-source");
          setDraggingProjectId(a.project.id);
        }
        a.ghost.style.left = `${ev.clientX - a.grabOffX}px`;
        a.ghost.style.top = `${ev.clientY - a.grabOffY}px`;
        recompute(ev.clientX, ev.clientY);
      };

      a.onUp = (ev) => {
        if (ev.pointerId !== a.pointerId) return;
        teardown(a.moved ? "drop" : "click");
      };

      a.onCancel = (ev) => {
        if (ev.pointerId !== a.pointerId) return;
        teardown("cancel");
      };

      a.onBlur = () => teardown("cancel");

      a.onScroll = () => {
        const c = lastCursorRef.current;
        if (!c) return;
        recompute(c.x, c.y);
      };

      activeRef.current = a;
      window.addEventListener("pointermove", a.onMove);
      window.addEventListener("pointerup", a.onUp);
      window.addEventListener("pointercancel", a.onCancel);
      window.addEventListener("lostpointercapture", a.onCancel);
      window.addEventListener("blur", a.onBlur);
      // capture-phase: scroll events don't bubble, so a non-capture
      // listener on document misses inner scrollers like .kanban-cards.
      document.addEventListener("scroll", a.onScroll, true);
    },
    [areas, teardown],
  );

  // Esc cancels — matches macOS expectations and the planner's blur-as-
  // cancel philosophy without piggybacking on window blur.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && activeRef.current) teardown("cancel");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [teardown]);

  // Cleanup if the parent unmounts mid-gesture.
  useEffect(() => () => {
    if (activeRef.current) teardown("cancel");
  }, [teardown]);

  return { draggingProjectId, dropColumnIndex, onCardPointerDown };
}
