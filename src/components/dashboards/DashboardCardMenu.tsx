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
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        ⋯
      </button>
      {open && (
        <div className="dcard-menu-dd" role="menu">
          <button
            type="button"
            className="dcard-menu-item"
            role="menuitem"
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
            role="menuitem"
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
