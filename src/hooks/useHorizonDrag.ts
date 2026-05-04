import { useCallback, useEffect, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { useHorizonStore } from "../store/horizon";
import { toast } from "../components/shared/Toast";
import { errMsg } from "../services/format";

// Spec §10 reads "HTML5 drag (как в Projects экране)" but Projects
// itself never uses HTML5 drag — `useKanbanGesture` documents why
// (lines 8-13: WKWebView starts native HTML5 drag inconsistently with
// our `user-select: none` body, generic divs, and the
// `-webkit-user-drag` opt-in). We follow that precedent: pointer
// events + a manually-rendered ghost. The drop target convention is
// the only horizon-specific bit — we look for `.month-cell[data-month]`
// regardless of which row the cell lives on (project rows AND the
// dedicated drop row both accept).

const DRAG_THRESHOLD_PX = 5;

interface Active {
  projectId: string;
  el: HTMLElement;
  onTap: () => void;
  pointerId: number;
  startX: number;
  startY: number;
  grabOffX: number;
  grabOffY: number;
  rectWidth: number;
  ghostHTML: string;
  moved: boolean;
  ghost: HTMLDivElement | null;
  pendingMonth: number | null;
  onMove: (e: PointerEvent) => void;
  onUp: (e: PointerEvent) => void;
  onCancel: (e: PointerEvent) => void;
  onBlur: () => void;
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

// Hit-test via elementFromPoint. Cells are small (≤80×36 px) and few
// (~80 visible at most), so the cached-rects optimisation kanban needs
// is overkill here — every move recomputes directly. The ghost has
// `pointer-events:none` so it doesn't shadow the cell underneath.
function findMonthDrop(x: number, y: number): number | null {
  const top = document.elementFromPoint(x, y) as Element | null;
  if (!top) return null;
  const cell = top.closest<HTMLElement>(".month-cell[data-month]");
  if (!cell) return null;
  const raw = cell.dataset.month;
  if (raw == null) return null;
  const n = Number(raw);
  return Number.isNaN(n) ? null : n;
}

export function useHorizonDrag() {
  const [draggingProjectId, setDraggingProjectId] = useState<string | null>(
    null,
  );
  const [dropMonthIndex, setDropMonthIndex] = useState<number | null>(null);
  const activeRef = useRef<Active | null>(null);
  const persistingRef = useRef(false);

  const teardown = useCallback((commit: "drop" | "tap" | "cancel") => {
    const a = activeRef.current;
    if (!a) return;
    window.removeEventListener("pointermove", a.onMove);
    window.removeEventListener("pointerup", a.onUp);
    window.removeEventListener("pointercancel", a.onCancel);
    window.removeEventListener("lostpointercapture", a.onCancel);
    window.removeEventListener("blur", a.onBlur);
    try {
      if (a.el.isConnected && a.el.hasPointerCapture?.(a.pointerId)) {
        a.el.releasePointerCapture(a.pointerId);
      }
    } catch {
      // Capture release fails when the element was unmounted mid-gesture.
    }
    a.el.classList.remove("dragging-source");

    const ghost = a.ghost;
    const pending = a.pendingMonth;
    const projectId = a.projectId;
    const onTap = a.onTap;
    activeRef.current = null;

    if (commit === "tap") {
      ghost?.remove();
      setDraggingProjectId(null);
      setDropMonthIndex(null);
      onTap();
      return;
    }

    if (commit === "cancel" || pending === null) {
      ghost?.remove();
      setDraggingProjectId(null);
      setDropMonthIndex(null);
      return;
    }

    // Persist-first ordering matches kanban: keep the ghost visible
    // until the store write resolves, so the project's chip re-renders
    // in its target month under the still-shown ghost (no one-frame
    // gap where the user sees neither).
    persistingRef.current = true;
    void (async () => {
      try {
        const cur = useHorizonStore
          .getState()
          .projects.find((p) => p.project_id === projectId);
        if (!cur) throw new Error("project missing in horizon");
        const nextMonths = cur.months.includes(pending)
          ? cur.months
          : [...cur.months, pending].sort((x, y) => x - y);
        if (nextMonths !== cur.months) {
          await useHorizonStore.getState().setMonths(projectId, nextMonths);
        }
        if (cur.hidden) {
          await useHorizonStore.getState().setHidden(projectId, false);
        }
      } catch (e) {
        toast.error(`Не удалось: ${errMsg(e)}`);
      } finally {
        ghost?.remove();
        setDraggingProjectId(null);
        setDropMonthIndex(null);
        persistingRef.current = false;
      }
    })();
  }, []);

  const onItemPointerDown = useCallback(
    (
      e: ReactPointerEvent<HTMLDivElement>,
      projectId: string,
      title: string,
      onTap: () => void,
    ) => {
      if (e.button !== 0) return;
      if (activeRef.current || persistingRef.current) return;

      const el = e.currentTarget;
      const rect = el.getBoundingClientRect();
      e.preventDefault();
      try {
        el.setPointerCapture(e.pointerId);
      } catch {
        // WKWebView occasionally rejects re-capture; window listeners
        // still drive the gesture.
      }

      const a: Active = {
        projectId,
        el,
        onTap,
        pointerId: e.pointerId,
        startX: e.clientX,
        startY: e.clientY,
        grabOffX: e.clientX - rect.left,
        grabOffY: e.clientY - rect.top,
        rectWidth: rect.width,
        ghostHTML: `<div class="bl-title">${escapeHtml(title)}</div>`,
        moved: false,
        ghost: null,
        pendingMonth: null,
        onMove: () => {},
        onUp: () => {},
        onCancel: () => {},
        onBlur: () => {},
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
        if (!a.ghost) {
          const g = document.createElement("div");
          g.className = "drag-ghost hz-bl-ghost";
          g.style.width = `${a.rectWidth}px`;
          g.innerHTML = a.ghostHTML;
          document.body.appendChild(g);
          a.ghost = g;
          a.el.classList.add("dragging-source");
          setDraggingProjectId(a.projectId);
        }
        a.ghost.style.left = `${ev.clientX - a.grabOffX}px`;
        a.ghost.style.top = `${ev.clientY - a.grabOffY}px`;
        const next = findMonthDrop(ev.clientX, ev.clientY);
        if (next !== a.pendingMonth) {
          a.pendingMonth = next;
          setDropMonthIndex(next);
        }
      };

      a.onUp = (ev) => {
        if (ev.pointerId !== a.pointerId) return;
        teardown(a.moved ? "drop" : "tap");
      };

      a.onCancel = (ev) => {
        if (ev.pointerId !== a.pointerId) return;
        teardown("cancel");
      };

      a.onBlur = () => teardown("cancel");

      activeRef.current = a;
      window.addEventListener("pointermove", a.onMove);
      window.addEventListener("pointerup", a.onUp);
      window.addEventListener("pointercancel", a.onCancel);
      window.addEventListener("lostpointercapture", a.onCancel);
      window.addEventListener("blur", a.onBlur);
    },
    [teardown],
  );

  // Esc cancels — matches macOS expectations.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && activeRef.current) teardown("cancel");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [teardown]);

  // Cleanup if the page unmounts mid-gesture.
  useEffect(
    () => () => {
      if (activeRef.current) teardown("cancel");
    },
    [teardown],
  );

  return { draggingProjectId, dropMonthIndex, onItemPointerDown };
}
