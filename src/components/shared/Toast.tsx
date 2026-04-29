import { create } from "zustand";
import { useConfigStore } from "../../store/config";

type ToastKind = "success" | "error";

interface ToastItem {
  id: string;
  kind: ToastKind;
  text: string;
  category: string | null;
}

interface ToastStore {
  current: ToastItem | null;
  show: (item: Omit<ToastItem, "id">) => void;
  dismiss: (id: string) => void;
}

const DISMISS_MS = 2200;

function genId(): string {
  return `t-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

const useToastStore = create<ToastStore>((set, get) => ({
  current: null,
  show: (item) => {
    const id = genId();
    set({ current: { id, ...item } });
    window.setTimeout(() => get().dismiss(id), DISMISS_MS);
  },
  dismiss: (id) =>
    set((s) => (s.current?.id === id ? { current: null } : s)),
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
  const item = useToastStore((s) => s.current);
  // Select the stable `config` reference; deriving `areas` inline
  // would return a fresh `[]` on every render and trip the React
  // infinite-loop guard via getSnapshot.
  const config = useConfigStore((s) => s.config);
  if (!item) return null;
  const areas = config?.areas;
  const dotColor =
    item.category != null && areas
      ? areas.find((a) => a.id === item.category)?.color ?? null
      : null;
  return (
    <div
      className={`toast toast-${item.kind}`}
      role={item.kind === "error" ? "alert" : "status"}
      aria-live={item.kind === "error" ? "assertive" : "polite"}
      aria-atomic="true"
    >
      {dotColor && (
        <span
          className="toast-dot"
          style={{ background: dotColor }}
          aria-hidden="true"
        />
      )}
      <span className="toast-text">{item.text}</span>
    </div>
  );
}
