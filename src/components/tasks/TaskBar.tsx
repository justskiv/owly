import { useEffect, useRef, useState } from "react";
import { useUIStore } from "../../store/ui";
import { useConfigStore } from "../../store/config";
import { createFromQuickAdd } from "../../services/quick-add-create";
import { getAreaColor } from "../../services/categories";
import { CatPickerPopup } from "../shared/CatPickerPopup";
import { toast } from "../shared/Toast";

export function TaskBar() {
  const taskAddCat = useUIStore((s) => s.taskAddCat);
  const setTaskAddCat = useUIStore((s) => s.setTaskAddCat);
  const taskSearch = useUIStore((s) => s.taskSearch);
  const setTaskSearch = useUIStore((s) => s.setTaskSearch);
  const areas = useConfigStore((s) => s.config?.areas ?? []);

  const [mode, setMode] = useState<"search" | "add">("search");
  const [addText, setAddText] = useState("");
  const [picker, setPicker] = useState<{ x: number; y: number } | null>(null);

  const wrapRef = useRef<HTMLDivElement>(null);
  const addInputRef = useRef<HTMLInputElement>(null);
  const dotRef = useRef<HTMLButtonElement>(null);

  // Auto-focus the add input when entering add mode.
  useEffect(() => {
    if (mode === "add") requestAnimationFrame(() => addInputRef.current?.focus());
  }, [mode]);

  // Click-outside returns to search mode. Cat picker lives in a portal,
  // so explicitly whitelist it here — otherwise picking a category would
  // dismiss the bar before the selection lands.
  useEffect(() => {
    if (mode !== "add") return;
    const handler = (e: MouseEvent) => {
      const target = e.target as Element | null;
      if (!target) return;
      if (wrapRef.current?.contains(target as Node)) return;
      if (target.closest?.(".cat-popup")) return;
      setMode("search");
      setAddText("");
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [mode]);

  const submitAdd = async () => {
    const title = addText.trim();
    if (!title || !taskAddCat) return;
    try {
      const entity = await createFromQuickAdd({
        parsed: { title, deadline: null },
        type: "task",
        category: taskAddCat,
      });
      toast.success(`✓ ${entity.title}`, { category: taskAddCat });
      setAddText("");
      addInputRef.current?.focus();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const exitAdd = () => {
    setMode("search");
    setAddText("");
  };

  const openCatPicker = () => {
    if (!dotRef.current) return;
    const r = dotRef.current.getBoundingClientRect();
    setPicker({ x: r.left, y: r.bottom + 4 });
  };

  const dotColor = taskAddCat
    ? getAreaColor(taskAddCat, areas)
    : "var(--text-tertiary)";

  return (
    <div ref={wrapRef} className="task-bar-wrap">
      <div
        className={`tb-left${mode === "add" ? " as-field" : " as-btn"}`}
      >
        {mode === "search" ? (
          <button
            type="button"
            className="tb-plus"
            onClick={() => setMode("add")}
            aria-label="Добавить задачу"
          >
            +
          </button>
        ) : (
          <>
            <button
              ref={dotRef}
              type="button"
              className="tb-dot"
              style={{ background: dotColor }}
              onClick={openCatPicker}
              aria-label="Категория"
            />
            <input
              ref={addInputRef}
              type="text"
              className="tb-add-input"
              value={addText}
              onChange={(e) => setAddText(e.target.value)}
              onKeyDown={(e) => {
                if (e.nativeEvent.isComposing) return;
                if (e.key === "Enter") {
                  e.preventDefault();
                  void submitAdd();
                } else if (e.key === "Escape") {
                  e.preventDefault();
                  exitAdd();
                }
              }}
              placeholder="Что добавить?"
              maxLength={200}
              autoComplete="off"
              spellCheck={false}
            />
            <button
              type="button"
              className="tb-clear"
              onClick={exitAdd}
              aria-label="Закрыть"
            >
              ×
            </button>
          </>
        )}
      </div>
      <div className={`tb-right${mode === "add" ? " hidden" : ""}`}>
        <span className="tb-icon" aria-hidden>
          🔍
        </span>
        <input
          type="text"
          className="tb-search-input"
          value={taskSearch}
          onChange={(e) => setTaskSearch(e.target.value)}
          placeholder="Поиск задач…"
          aria-label="Поиск задач"
        />
        {taskSearch && (
          <button
            type="button"
            className="tb-clear"
            onClick={() => setTaskSearch("")}
            aria-label="Очистить поиск"
          >
            ×
          </button>
        )}
      </div>
      {picker && (
        <CatPickerPopup
          anchor={picker}
          current={taskAddCat}
          areas={areas}
          onSelect={(id) => setTaskAddCat(id)}
          onClose={() => setPicker(null)}
        />
      )}
    </div>
  );
}
