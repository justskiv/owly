import { useCallback, useMemo, useState } from "react";
import type { EditorPrefill } from "../components/planner/BlockEditor";

export type Overlay =
  | null
  | { kind: "editor-new"; defaults: EditorPrefill }
  | { kind: "editor-edit"; blockId: string }
  | { kind: "context"; x: number; y: number; blockId: string }
  | { kind: "inline-create"; date: string; minute: number };

export function usePlannerOverlay() {
  const [overlay, setOverlay] = useState<Overlay>(null);

  const close = useCallback(() => setOverlay(null), []);

  const openEditorNew = useCallback(
    (defaults: EditorPrefill) =>
      setOverlay({ kind: "editor-new", defaults }),
    [],
  );

  const openEditorEdit = useCallback(
    (blockId: string) => setOverlay({ kind: "editor-edit", blockId }),
    [],
  );

  const openContext = useCallback(
    (x: number, y: number, blockId: string) =>
      setOverlay({ kind: "context", x, y, blockId }),
    [],
  );

  const openInline = useCallback(
    (date: string, minute: number) =>
      setOverlay({ kind: "inline-create", date, minute }),
    [],
  );

  // Stable object identity between renders when overlay state is
  // unchanged — keeps consumer useCallbacks from needlessly
  // re-registering listeners (keydown, dnd-kit sensors in phase 3).
  return useMemo(
    () => ({
      overlay,
      close,
      openEditorNew,
      openEditorEdit,
      openContext,
      openInline,
    }),
    [overlay, close, openEditorNew, openEditorEdit, openContext, openInline],
  );
}
