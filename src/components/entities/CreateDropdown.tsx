import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type RefObject,
} from "react";
import { useUIStore } from "../../store/ui";
import {
  ENTITY_CREATE_TYPES,
  ENTITY_ICONS,
  ENTITY_LABELS_ACC,
} from "../../services/entity-icons";

interface Props {
  anchorRef: RefObject<HTMLButtonElement | null>;
  onClose: () => void;
}

export function CreateDropdown({ anchorRef, onClose }: Props) {
  const openEditorNew = useUIStore((s) => s.openEntityEditorNew);
  const menuRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const [pos, setPos] = useState<{ top: number; right: number } | null>(null);

  // Position under the anchor button. Computed once on mount — the
  // header doesn't scroll or resize mid-dropdown in this app.
  useEffect(() => {
    const btn = anchorRef.current;
    if (!btn) return;
    const rect = btn.getBoundingClientRect();
    setPos({
      top: rect.bottom + 4,
      right: window.innerWidth - rect.right,
    });
  }, [anchorRef]);

  // Move focus into the menu once it renders; without this the menu
  // opens but keyboard stays on the anchor button, making ArrowDown
  // land in the button bar instead of navigating menu items.
  useEffect(() => {
    if (!pos) return;
    itemRefs.current[0]?.focus();
  }, [pos]);

  // Close on outside click or Escape. Using pointerdown matches the
  // rest of the app (BlockEditor backdrop).
  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      const target = e.target as Node | null;
      if (
        menuRef.current &&
        target &&
        !menuRef.current.contains(target) &&
        !anchorRef.current?.contains(target)
      ) {
        onClose();
      }
    };
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("pointerdown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [anchorRef, onClose]);

  if (!pos) return null;

  const onItemKey = (e: KeyboardEvent<HTMLButtonElement>, idx: number) => {
    const total = ENTITY_CREATE_TYPES.length;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      itemRefs.current[(idx + 1) % total]?.focus();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      itemRefs.current[(idx - 1 + total) % total]?.focus();
    } else if (e.key === "Home") {
      e.preventDefault();
      itemRefs.current[0]?.focus();
    } else if (e.key === "End") {
      e.preventDefault();
      itemRefs.current[total - 1]?.focus();
    }
  };

  return (
    <div
      ref={menuRef}
      className="create-dd"
      role="menu"
      style={{ top: pos.top, right: pos.right }}
    >
      {ENTITY_CREATE_TYPES.map((t, idx) => (
        <button
          key={t}
          ref={(el) => {
            itemRefs.current[idx] = el;
          }}
          type="button"
          className="create-dd-item"
          role="menuitem"
          onClick={() => {
            openEditorNew(t);
            onClose();
          }}
          onKeyDown={(e) => onItemKey(e, idx)}
        >
          <span style={{ width: 18, display: "inline-block" }}>
            {ENTITY_ICONS[t]}
          </span>
          Создать {ENTITY_LABELS_ACC[t]}
        </button>
      ))}
    </div>
  );
}
