import { useEffect, useState } from "react";
import type { MetricHistoryItem } from "../../../schemas";

interface Props {
  history: MetricHistoryItem[];
  onChange: (next: MetricHistoryItem[]) => void;
}

function todayISO(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// Numeric inputs with a string-backed draft: Number(e.target.value) on
// every keystroke eats intermediate decimals ("0." becomes 0) and
// silently accepts Infinity/NaN. We buffer text locally and only
// commit a valid finite number on blur or Enter; invalid input reverts
// to the previous stored value so the user sees why it didn't stick.
function NumericField({
  value,
  onCommit,
  style,
}: {
  value: number;
  onCommit: (next: number) => void;
  style?: React.CSSProperties;
}) {
  const [draft, setDraft] = useState<string>(() => String(value));
  useEffect(() => {
    setDraft(String(value));
  }, [value]);

  const commit = () => {
    const n = parseFloat(draft.replace(",", "."));
    if (Number.isFinite(n)) {
      onCommit(n);
    } else {
      setDraft(String(value));
    }
  };

  return (
    <input
      type="text"
      inputMode="decimal"
      className="fi"
      style={{ fontFamily: "var(--mono)", ...style }}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          commit();
          (e.target as HTMLInputElement).blur();
        }
      }}
    />
  );
}

export function HistoryEditor({ history, onChange }: Props) {
  const add = () =>
    onChange([...history, { date: todayISO(), value: 0 }]);
  const remove = (i: number) =>
    onChange(history.filter((_, idx) => idx !== i));
  const editDate = (i: number, date: string) =>
    onChange(history.map((h, idx) => (idx === i ? { ...h, date } : h)));
  const editValue = (i: number, value: number) =>
    onChange(history.map((h, idx) => (idx === i ? { ...h, value } : h)));

  return (
    <div className="fg">
      <label className="fl">История</label>
      <div className="editor-list">
        {history.map((h, i) => (
          <div key={i} className="editor-row">
            <input
              type="date"
              className="fi"
              style={{ maxWidth: 150 }}
              value={h.date}
              onChange={(e) => editDate(i, e.target.value)}
            />
            <NumericField
              value={h.value}
              onCommit={(v) => editValue(i, v)}
            />
            <button
              type="button"
              className="editor-x"
              aria-label="Удалить"
              onClick={() => remove(i)}
            >
              ×
            </button>
          </div>
        ))}
        <button
          type="button"
          className="editor-add"
          onClick={add}
        >
          + Добавить замер
        </button>
      </div>
    </div>
  );
}
