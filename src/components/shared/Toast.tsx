import { create } from "zustand";
import type { CSSProperties, AnimationEvent } from "react";
import { useConfigStore } from "../../store/config";

type ToastKind = "success" | "error";

interface ToastItem {
  id: string;
  kind: ToastKind;
  text: string;
  category: string | null;
  leaving: boolean;
}

interface ToastStore {
  items: ToastItem[];
  show: (input: Omit<ToastItem, "id" | "leaving">) => void;
  startLeaving: (id: string) => void;
  finalize: (id: string) => void;
  pause: (id: string) => void;
  resume: (id: string) => void;
}

const DISMISS_MS = 2200;
// Soft cap on the in-memory queue — anything past MAX_KEEP can never
// be visible (MAX_VISIBLE caps the render), trimming keeps memory flat
// under fast bursts.
const MAX_KEEP = 8;
// Hard render cap. 4 keeps the stack readable; the fourth at alpha .14
// signals "older bumped off".
const MAX_VISIBLE = 4;
const STACK_BASE_TOP_PX = 56;
const STACK_STEP_PX = 38;
const STACK_SCALE_STEP = 0.03;
// Sharper than linear: newest fully opaque, second drops hard, then
// a steep tail. Encodes "what just happened > history".
const STACK_OPACITY = [1, 0.66, 0.36, 0.14] as const;

function genId(): string {
  return `t-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

// Module-level timer map — Zustand stores serialise-clean state, so
// the live timeout handles live next to the store but outside it.
const timers = new Map<string, number>();

function scheduleAutoDismiss(id: string) {
  const existing = timers.get(id);
  if (existing != null) clearTimeout(existing);
  const t = window.setTimeout(() => {
    timers.delete(id);
    useToastStore.getState().startLeaving(id);
  }, DISMISS_MS);
  timers.set(id, t);
}

const useToastStore = create<ToastStore>((set, get) => ({
  items: [],
  show: (input) => {
    const id = genId();
    set((s) => ({
      // Newest first → renders at the top of the stack; older items
      // shift down and fade.
      items: [{ id, leaving: false, ...input }, ...s.items].slice(0, MAX_KEEP),
    }));
    scheduleAutoDismiss(id);
  },
  // Marks the toast as exiting; the component runs the toastOut
  // animation and calls finalize on its end. Splitting "leave"
  // from "remove" lets the exit animation run inside React.
  startLeaving: (id) =>
    set((s) => ({
      items: s.items.map((it) =>
        it.id === id ? { ...it, leaving: true } : it,
      ),
    })),
  finalize: (id) => {
    const t = timers.get(id);
    if (t != null) {
      clearTimeout(t);
      timers.delete(id);
    }
    set((s) => ({ items: s.items.filter((i) => i.id !== id) }));
  },
  // Hover-pause on the top toast — stops the auto-dismiss while the
  // user is reading. Does not touch leaving toasts (their animation
  // is already in flight).
  pause: (id) => {
    const t = timers.get(id);
    if (t != null) {
      clearTimeout(t);
      timers.delete(id);
    }
  },
  resume: (id) => {
    if (timers.has(id)) return;
    const item = get().items.find((i) => i.id === id);
    if (!item || item.leaving) return;
    scheduleAutoDismiss(id);
  },
}));

export const toast = {
  success: (text: string, opts?: { category?: string }) =>
    useToastStore
      .getState()
      .show({ kind: "success", text, category: opts?.category ?? null }),
  error: (text: string) =>
    useToastStore.getState().show({ kind: "error", text, category: null }),
};

export function Toast() {
  const items = useToastStore((s) => s.items);
  const pause = useToastStore((s) => s.pause);
  const resume = useToastStore((s) => s.resume);
  const finalize = useToastStore((s) => s.finalize);
  // Select the stable `config` reference; deriving `areas` inline
  // would return a fresh `[]` on every render and trip the React
  // infinite-loop guard via getSnapshot.
  const config = useConfigStore((s) => s.config);
  if (items.length === 0) return null;
  const areas = config?.areas;
  return (
    <>
      {items.slice(0, MAX_VISIBLE).map((item, i) => {
        const opacity = STACK_OPACITY[i] ?? 0;
        const scale = 1 - i * STACK_SCALE_STEP;
        const top = STACK_BASE_TOP_PX + i * STACK_STEP_PX;
        const isTop = i === 0;
        const dotColor =
          item.category != null && areas
            ? areas.find((a) => a.id === item.category)?.color ?? null
            : null;
        // transformOrigin pins the scale to the top edge so older
        // items appear to recede away from the viewport, not float.
        const style: CSSProperties = {
          top,
          opacity,
          transform: `translateX(-50%) scale(${scale})`,
          transformOrigin: "top center",
          // Only the topmost is interactive; older ones must let the
          // cursor through to UI behind them.
          pointerEvents: isTop ? "auto" : "none",
        };
        const onAnimEnd = (e: AnimationEvent<HTMLDivElement>) => {
          if (e.animationName === "toastOut") finalize(item.id);
        };
        return (
          <div
            key={item.id}
            className={`toast toast-${item.kind}${item.leaving ? " toast-leaving" : ""}`}
            style={style}
            role={item.kind === "error" ? "alert" : "status"}
            aria-live={item.kind === "error" ? "assertive" : "polite"}
            aria-atomic="true"
            onMouseEnter={isTop ? () => pause(item.id) : undefined}
            onMouseLeave={isTop ? () => resume(item.id) : undefined}
            onAnimationEnd={onAnimEnd}
          >
            {dotColor && (
              <span
                className="toast-dot"
                // Using `color` (not background) so currentColor on
                // the span lights both the fill and the box-shadow halo.
                style={{ color: dotColor }}
                aria-hidden="true"
              />
            )}
            <span className="toast-text">{item.text}</span>
          </div>
        );
      })}
    </>
  );
}
