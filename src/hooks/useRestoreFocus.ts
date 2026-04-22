import { useEffect, useState } from "react";

// Capture document.activeElement at mount time (via lazy useState init,
// which runs in the parent's render phase — before any child effect can
// steal focus) and restore it when the component unmounts. Used by
// modal/dialog wrappers so closing returns focus to the element that
// opened the dialog.
export function useRestoreFocus(active: boolean) {
  const [prev] = useState<HTMLElement | null>(() =>
    active ? (document.activeElement as HTMLElement | null) : null,
  );
  useEffect(() => {
    if (!active || !prev) return;
    return () => {
      queueMicrotask(() => prev.focus({ preventScroll: true }));
    };
  }, [active, prev]);
}
