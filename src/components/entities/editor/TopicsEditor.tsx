import { useState, type KeyboardEvent } from "react";
import type { ContactTopic } from "../../../schemas";

interface Props {
  topics: ContactTopic[];
  onChange: (next: ContactTopic[]) => void;
}

export function TopicsEditor({ topics, onChange }: Props) {
  const [input, setInput] = useState("");

  const add = () => {
    const t = input.trim();
    if (!t) return;
    onChange([...topics, { text: t, done: false }]);
    setInput("");
  };
  const toggle = (i: number) =>
    onChange(
      topics.map((it, idx) =>
        idx === i ? { ...it, done: !it.done } : it,
      ),
    );
  const remove = (i: number) =>
    onChange(topics.filter((_, idx) => idx !== i));
  const edit = (i: number, text: string) =>
    onChange(topics.map((it, idx) => (idx === i ? { ...it, text } : it)));

  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      add();
    }
  };

  return (
    <div className="fg">
      <label className="fl">Темы для обсуждения</label>
      <div className="editor-list">
        {topics.map((it, i) => (
          <div key={i} className="editor-row">
            <input
              type="checkbox"
              checked={it.done}
              onChange={() => toggle(i)}
            />
            <input
              className="fi"
              value={it.text}
              onChange={(e) => edit(i, e.target.value)}
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
        <div className="editor-row">
          <input
            className="fi"
            placeholder="+ новая тема"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKey}
          />
          <button
            type="button"
            className="btn-save editor-add-btn"
            onClick={add}
          >
            +
          </button>
        </div>
      </div>
    </div>
  );
}
