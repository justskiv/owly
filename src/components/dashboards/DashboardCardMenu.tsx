import { useEffect, useRef, useState } from "react";

interface Props {
  onRename: () => void;
  onDelete: () => void;
}

// Three-dot menu rendered in the top-right corner of a dashboard
// card. Stops click propagation so opening the menu doesn't also
// trigger the card's onOpen handler.
export function DashboardCardMenu({ onRename, onDelete }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node | null;
      if (ref.current && t && !ref.current.contains(t)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("pointerdown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        className="dcard-menu"
        aria-label="Меню дашборда"
        aria-haspopup="true"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        ⋯
      </button>
      {open && (
        // No role="menu" here: this is a 2-item dropdown where Tab is
        // the natural keyboard model. role="menu" would imply Arrow
        // navigation (per WAI-ARIA APG), which we don't implement.
        <div className="dcard-menu-dd">
          <button
            type="button"
            className="dcard-menu-item"
            onClick={() => {
              setOpen(false);
              onRename();
            }}
          >
            Переименовать
          </button>
          <button
            type="button"
            className="dcard-menu-item danger"
            onClick={() => {
              setOpen(false);
              onDelete();
            }}
          >
            Удалить
          </button>
        </div>
      )}
    </div>
  );
}
