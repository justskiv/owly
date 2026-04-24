import type { ImportantDate } from "../../../schemas";

interface Props {
  dates: ImportantDate[];
  onChange: (next: ImportantDate[]) => void;
}

export function ImportantDatesEditor({ dates, onChange }: Props) {
  const add = () =>
    onChange([...dates, { label: "", date: "01-01" }]);
  const remove = (i: number) =>
    onChange(dates.filter((_, idx) => idx !== i));
  const editLabel = (i: number, label: string) =>
    onChange(dates.map((d, idx) => (idx === i ? { ...d, label } : d)));
  const editDate = (i: number, date: string) =>
    onChange(dates.map((d, idx) => (idx === i ? { ...d, date } : d)));

  return (
    <div className="fg">
      <label className="fl">Важные даты</label>
      <div className="editor-list">
        {dates.map((d, i) => (
          <div key={i} className="editor-row">
            <input
              className="fi"
              placeholder="Название"
              value={d.label}
              onChange={(e) => editLabel(i, e.target.value)}
            />
            <input
              className="fi"
              style={{ fontFamily: "var(--mono)", maxWidth: 100 }}
              placeholder="ММ-ДД"
              value={d.date}
              onChange={(e) => editDate(i, e.target.value)}
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
          + Добавить дату
        </button>
      </div>
    </div>
  );
}
