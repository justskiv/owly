import type { ChecklistItem } from "../../../../schemas";

interface Props {
  items: ChecklistItem[];
  onToggle: (idx: number) => void;
}

export function Checklist({ items, onToggle }: Props) {
  return (
    <ul className="edp-cl">
      {items.map((it, idx) => (
        <li
          key={idx}
          className={it.done ? "done" : ""}
          onClick={() => onToggle(idx)}
        >
          <span className={`edp-chk${it.done ? " checked" : ""}`} />
          <span className="edp-cl-text">{it.text}</span>
        </li>
      ))}
    </ul>
  );
}
