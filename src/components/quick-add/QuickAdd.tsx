import { useEffect, useRef, useState } from "react";
import { useUIStore, type QAType } from "../../store/ui";
import { useConfigStore } from "../../store/config";
import { useEscape } from "../../hooks/useEscape";
import { parseQuickAdd } from "../../services/quick-add-parser";
import { createFromQuickAdd } from "../../services/quick-add-create";
import { toast } from "../shared/Toast";

const TYPE_LABEL_RU: Record<QAType, string> = {
  task: "Задача",
  project: "Проект",
  direction: "Направление",
};
const TYPE_ORDER: QAType[] = ["task", "project", "direction"];
const EMPTY_AREAS: never[] = [];

export function QuickAdd() {
  const state = useUIStore((s) => s.quickAdd);
  const close = useUIStore((s) => s.closeQuickAdd);
  const setType = useUIStore((s) => s.setQuickAddType);
  const setCategory = useUIStore((s) => s.setQuickAddCategory);
  // Stable selector — returning `?? []` would build a new array each
  // render and trigger React's getSnapshot infinite-loop guard.
  const config = useConfigStore((s) => s.config);
  const areas = config?.areas ?? EMPTY_AREAS;

  const [input, setInput] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const barRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (state.open) {
      setInput("");
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [state.open]);

  useEscape(close, state.open);

  if (!state.open) return null;

  const empty = areas.length === 0;
  const canSubmit = !empty && state.category != null;

  const submit = async () => {
    const parsed = parseQuickAdd(input);
    if (!parsed.title.trim()) {
      close();
      return;
    }
    if (!state.category) return;
    try {
      const entity = await createFromQuickAdd({
        parsed,
        type: state.type,
        category: state.category,
      });
      toast.success(`✓ ${entity.title}`, { category: state.category });
    } catch (e) {
      toast.error((e as Error).message);
    }
    close();
  };

  return (
    <div
      className="qa-overlay"
      onMouseDown={(e) => {
        if (!barRef.current?.contains(e.target as Node)) close();
      }}
      role="dialog"
      aria-modal="true"
      aria-label="Быстрое создание"
    >
      <div className="qa-bar" ref={barRef}>
        <div className="qa-input-row">
          <input
            ref={inputRef}
            className="qa-input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void submit();
            }}
            placeholder="Что добавить? !завтра, !05.15…"
            disabled={empty}
          />
          <button
            type="button"
            className="qa-submit"
            onClick={() => void submit()}
            disabled={!canSubmit}
            aria-label="Создать"
          >
            ↵
          </button>
        </div>
        <div className="qa-meta">⌘N · Тип: {state.hintLabel}</div>
        {empty ? (
          <div className="qa-empty">
            Сначала добавьте области в Settings
          </div>
        ) : (
          <div className="qa-extras">
            <div className="qa-cats">
              {areas.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  className={`qa-cat-dot${state.category === a.id ? " on" : ""}`}
                  style={{ background: a.color }}
                  onClick={() => setCategory(a.id)}
                  title={a.label}
                  aria-label={a.label}
                  aria-pressed={state.category === a.id}
                />
              ))}
            </div>
            <span className="qa-sep" aria-hidden="true">
              |
            </span>
            <div className="qa-toggles">
              {TYPE_ORDER.map((t) => (
                <button
                  key={t}
                  type="button"
                  className={`qa-toggle${state.type === t ? " on" : ""}`}
                  onClick={() => setType(t)}
                  aria-pressed={state.type === t}
                >
                  {TYPE_LABEL_RU[t]}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
