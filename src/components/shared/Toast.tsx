import { create } from "zustand";

type ToastType = "success" | "error";

interface ToastItem {
  id: string;
  type: ToastType;
  text: string;
}

interface ToastStore {
  toasts: ToastItem[];
  push: (type: ToastType, text: string) => void;
  remove: (id: string) => void;
}

const DISMISS_MS = 2500;

function genId(): string {
  return `t-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

const useToastStore = create<ToastStore>((set, get) => ({
  toasts: [],
  push: (type, text) => {
    const id = genId();
    set((s) => ({ toasts: [...s.toasts, { id, type, text }] }));
    window.setTimeout(() => get().remove(id), DISMISS_MS);
  },
  remove: (id) =>
    set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

export const toast = {
  success: (text: string) => useToastStore.getState().push("success", text),
  error: (text: string) => useToastStore.getState().push("error", text),
};

export function Toast() {
  const toasts = useToastStore((s) => s.toasts);
  if (toasts.length === 0) return null;
  return (
    <div
      className="toast-c"
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      {toasts.map((t) => (
        <div key={t.id} className={`toast ${t.type}`}>
          {t.text}
        </div>
      ))}
    </div>
  );
}
