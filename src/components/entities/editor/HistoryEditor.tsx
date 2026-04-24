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
            <input
              type="number"
              className="fi"
              style={{ fontFamily: "var(--mono)" }}
              value={h.value}
              onChange={(e) => editValue(i, Number(e.target.value) || 0)}
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
