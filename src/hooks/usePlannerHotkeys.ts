import { useEffect } from "react";
import type { Block } from "../schemas";

interface HotkeysArgs {
  active: boolean;
  overlayOpen: boolean;
  gesturing: boolean;
  selectedBlock: Block | null;
  onCloseOverlay: () => void;
  onClearSelection: () => void;
  onCancelGesture: () => void;
  onOpenNew: () => void;
  onTogglePool: () => void;
  onOpenEdit: (block: Block) => void;
  onOpenContext: (block: Block) => void;
  onComplete: (block: Block) => void;
  onSkip: (block: Block) => void;
  onDelete: (block: Block) => void;
  onNudge: (block: Block, deltaMin: number) => void;
}

export function usePlannerHotkeys(args: HotkeysArgs) {
  const {
    active,
    overlayOpen,
    gesturing,
    selectedBlock,
    onCloseOverlay,
    onClearSelection,
    onCancelGesture,
    onOpenNew,
    onTogglePool,
    onOpenEdit,
    onOpenContext,
    onComplete,
    onSkip,
    onDelete,
    onNudge,
  } = args;

  useEffect(() => {
    if (!active) return;
    const handler = (e: KeyboardEvent) => {
      // Gesture cancel preempts every other guard — pool-search input
      // can keep focus while the user drags, and Escape must abort
      // the drag rather than just blur the field.
      if (e.key === "Escape" && gesturing) {
        onCancelGesture();
        return;
      }

      const t = e.target as HTMLElement | null;
      const isInputTarget =
        t instanceof HTMLInputElement ||
        t instanceof HTMLTextAreaElement ||
        (t != null && t.isContentEditable);

      // Guard 1: input target — let the field handle it (Esc blurs).
      if (isInputTarget) {
        if (e.key === "Escape") (t as HTMLElement).blur();
        return;
      }

      // Esc closes overlays + drops selection.
      if (e.key === "Escape") {
        onCloseOverlay();
        onClearSelection();
        return;
      }

      // Guard 2: overlay open or gesture in flight — swallow other
      // shortcuts (no accidental N/Delete while dragging a block).
      if (overlayOpen || gesturing) return;

      // Guard 3: letters require !meta && !ctrl && !alt to avoid
      // shadowing system shortcuts (Cmd+D etc).
      const noMod = !e.metaKey && !e.ctrlKey && !e.altKey;

      if (noMod && e.code === "KeyN") {
        e.preventDefault();
        onOpenNew();
        return;
      }
      if (noMod && e.code === "KeyT") {
        e.preventDefault();
        onTogglePool();
        return;
      }

      if (!selectedBlock) return;

      if (noMod && e.code === "KeyD") {
        void onComplete(selectedBlock);
      } else if (noMod && e.code === "KeyS") {
        void onSkip(selectedBlock);
      } else if (
        noMod &&
        (e.key === "Delete" || e.key === "Backspace")
      ) {
        void onDelete(selectedBlock);
      } else if (noMod && e.key === "Enter") {
        e.preventDefault();
        onOpenEdit(selectedBlock);
      } else if (
        (e.shiftKey && e.key === "F10" && !e.metaKey && !e.ctrlKey &&
          !e.altKey) ||
        e.key === "ContextMenu"
      ) {
        e.preventDefault();
        onOpenContext(selectedBlock);
      } else if (
        e.ctrlKey &&
        !e.metaKey &&
        !e.altKey &&
        (e.key === "ArrowUp" || e.key === "ArrowDown")
      ) {
        e.preventDefault();
        void onNudge(selectedBlock, e.key === "ArrowUp" ? -30 : 30);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [
    active,
    overlayOpen,
    gesturing,
    selectedBlock,
    onCloseOverlay,
    onClearSelection,
    onCancelGesture,
    onOpenNew,
    onTogglePool,
    onOpenEdit,
    onOpenContext,
    onComplete,
    onSkip,
    onDelete,
    onNudge,
  ]);
}
