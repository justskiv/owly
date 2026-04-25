import { useEffect } from "react";

// Subscribe a callback to the global Escape key while `active` is
// true. Used by modals and the dashboards host so each consumer
// doesn't repeat the same window listener boilerplate.
export function useEscape(handler: () => void, active = true) {
  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") handler();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [handler, active]);
}
