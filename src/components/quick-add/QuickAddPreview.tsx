import { useUIStore } from "../../store/ui";
import { isConflict } from "../../services/quick-add-tokenizer";

export function QuickAddPreview() {
  const tokens = useUIStore((s) => s.quickAdd.tokens);
  const deactivated = useUIStore((s) => s.quickAdd.deactivatedSpans);
  const deactivatedSet = new Set(deactivated);

  if (isConflict(tokens, deactivatedSet)) {
    return (
      <div className="qa-preview invalid">
        Несколько дат — оставьте одну
      </div>
    );
  }

  // The active modifier is the LAST non-deactivated date-modifier* — that
  // matches user mental model "the most recent one wins". An invalid
  // modifier still counts as "active" so we can show "Не похоже на дату".
  let active = null;
  for (let i = tokens.length - 1; i >= 0; i--) {
    const t = tokens[i];
    if (t.type === "text") continue;
    const span = `${t.start}-${t.end}`;
    if (deactivatedSet.has(span)) continue;
    active = t;
    break;
  }
  if (!active) return null;

  if (active.type === "date-modifier-invalid") {
    return <div className="qa-preview invalid">Не похоже на дату</div>;
  }
  const human = active.humanLabel ?? "";
  if (active.type === "date-modifier-past") {
    return <div className="qa-preview past">Прошло: {human}</div>;
  }
  return <div className="qa-preview">Дедлайн: {human}</div>;
}
