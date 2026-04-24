import { useMemo, useState, type KeyboardEvent } from "react";
import type { Area } from "../../../schemas";
import { getAreaColor, getAreaLabel } from "../../../services/categories";

interface Props {
  tags: string[];
  onChange: (next: string[]) => void;
  areas: Area[];
}

export function TagsField({ tags, onChange, areas }: Props) {
  const [input, setInput] = useState("");
  const [open, setOpen] = useState(false);

  const suggestions = useMemo(
    () =>
      areas
        .filter((a) => !tags.includes(a.id))
        .filter(
          (a) =>
            !input ||
            a.id.toLowerCase().includes(input.toLowerCase()) ||
            a.label.toLowerCase().includes(input.toLowerCase()),
        ),
    [areas, tags, input],
  );

  const add = (tag: string) => {
    const t = tag.trim();
    if (!t || tags.includes(t)) return;
    onChange([...tags, t]);
    setInput("");
    setOpen(false);
  };

  const remove = (tag: string) => {
    onChange(tags.filter((t) => t !== tag));
  };

  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      add(input);
    }
  };

  return (
    <div className="fg">
      <label className="fl">Теги</label>
      <div className="tags-field">
        {tags.map((t) => {
          const color = getAreaColor(t, areas);
          return (
            <span
              key={t}
              className="tags-chip"
              style={{ background: `${color}22`, color }}
            >
              {getAreaLabel(t, areas)}
              <button
                type="button"
                className="tags-chip-x"
                aria-label={`Убрать ${t}`}
                onClick={() => remove(t)}
              >
                ×
              </button>
            </span>
          );
        })}
        <div className="tags-add-wrap">
          <input
            type="text"
            className="tags-add-input"
            placeholder="+ добавить"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onFocus={() => setOpen(true)}
            onBlur={() => window.setTimeout(() => setOpen(false), 150)}
            onKeyDown={onKey}
          />
          {open && suggestions.length > 0 && (
            <div className="tags-dd">
              {suggestions.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  className="tags-dd-item"
                  onMouseDown={() => add(a.id)}
                >
                  <span
                    className="td"
                    style={{ background: a.color }}
                  />
                  {a.label}{" "}
                  <span
                    style={{
                      color: "var(--text-tertiary)",
                      marginLeft: 4,
                      fontFamily: "var(--mono)",
                      fontSize: "var(--fs-2xs)",
                    }}
                  >
                    {a.id}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
