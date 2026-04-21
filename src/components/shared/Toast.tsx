import { useEffect, useState } from "react";

type Variant = "success" | "error";
interface ToastState {
  message: string;
  variant: Variant;
}

let externalSetter: ((toast: ToastState | null) => void) | null = null;

export function showToast(message: string, variant: Variant = "success") {
  externalSetter?.({ message, variant });
}

export function Toast() {
  const [toast, setToast] = useState<ToastState | null>(null);

  useEffect(() => {
    externalSetter = setToast;
    return () => {
      externalSetter = null;
    };
  }, []);

  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(() => setToast(null), 3500);
    return () => window.clearTimeout(id);
  }, [toast]);

  if (!toast) return null;

  return (
    <div
      className={`fixed bottom-4 right-4 z-50 max-w-sm rounded-lg px-4 py-3 text-sm shadow-xl ${
        toast.variant === "success"
          ? "bg-green-600 text-white"
          : "bg-red-600 text-white"
      }`}
    >
      {toast.message}
    </div>
  );
}
