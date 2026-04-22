import type { KeyboardEvent } from "react";

export function makeClickable(el: HTMLElement | null): void {
  if (!el) return;
  el.tabIndex = 0;
  el.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      e.stopPropagation();
      el.click();
    }
  });
}

export function clickableProps(onClick: () => void) {
  return {
    tabIndex: 0,
    role: "button" as const,
    onClick,
    onKeyDown: (e: KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        onClick();
      }
    },
  };
}
