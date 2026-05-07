import { userEvent } from "vitest/browser";
import type { Locator } from "@vitest/browser/context";

// For elements driven by useBlockGesture / useBacklogGesture etc.
// Sends raw pointer events with intermediate moves to clear the
// drag-threshold (DRAG_THRESHOLD_PX = 5 in useBlockGesture.ts).
export async function dragWithPointer(
  source: Locator,
  target: { x: number; y: number },
  opts: { steps?: number } = {},
): Promise<void> {
  const src = source.element() as HTMLElement;
  const r = src.getBoundingClientRect();
  const startX = r.left + r.width / 2;
  const startY = r.top + r.height / 2;
  const steps = opts.steps ?? 5;

  src.dispatchEvent(
    new PointerEvent("pointerdown", {
      bubbles: true,
      clientX: startX,
      clientY: startY,
      pointerId: 1,
      button: 0,
      isPrimary: true,
    }),
  );

  for (let i = 1; i <= steps; i++) {
    const x = startX + (target.x - startX) * (i / steps);
    const y = startY + (target.y - startY) * (i / steps);
    document.dispatchEvent(
      new PointerEvent("pointermove", {
        bubbles: true,
        clientX: x,
        clientY: y,
        pointerId: 1,
      }),
    );
  }

  document.dispatchEvent(
    new PointerEvent("pointerup", {
      bubbles: true,
      clientX: target.x,
      clientY: target.y,
      pointerId: 1,
    }),
  );
}

// For HTML5 DragEvent paths (kanban with draggable=true). The
// existing PlannerPage drag test happens to work via this path
// through chromium polyfills; new tests should pick the helper
// that matches the actual interaction model.
export async function dragWithDragEvent(
  source: Locator,
  target: HTMLElement | Locator,
): Promise<void> {
  const tgt =
    target instanceof HTMLElement
      ? target
      : (target.element() as HTMLElement);
  await userEvent.dragAndDrop(source, tgt);
}
