import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { useUIStore, type QAType } from "../../store/ui";
import { useConfigStore } from "../../store/config";
import { useEscape } from "../../hooks/useEscape";
import { isConflict, tokensToParsed } from "../../services/quick-add-tokenizer";
import { buildPopoverItems } from "../../services/quick-add-popover-items";
import { formatDate, getStartOfDay } from "../../services/time-utils";
import { createFromQuickAdd } from "../../services/quick-add-create";
import { toast } from "../shared/Toast";
import { QuickAddInput } from "./QuickAddInput";
import { QuickAddPopover } from "./QuickAddPopover";
import { QuickAddDatePicker } from "./QuickAddDatePicker";
import { QuickAddPreview } from "./QuickAddPreview";
import { Tooltip } from "../shared/Tooltip";
import { errMsg } from "../../services/format";

const TYPE_LABEL_RU: Record<QAType, string> = {
  task: "Задача",
  project: "Проект",
  direction: "Направление",
};
const TYPE_ORDER: QAType[] = ["task", "project", "direction"];
const SHAKE_MS = 320;
const EMPTY_AREAS: never[] = [];

export function QuickAdd() {
  const state = useUIStore((s) => s.quickAdd);
  const close = useUIStore((s) => s.closeQuickAdd);
  const setType = useUIStore((s) => s.setQuickAddType);
  const setCategory = useUIStore((s) => s.setQuickAddCategory);
  const setInput = useUIStore((s) => s.setQuickAddInput);
  const toggleTokenActive = useUIStore((s) => s.toggleTokenActive);
  const openPopover = useUIStore((s) => s.openPopover);
  const closePopover = useUIStore((s) => s.closePopover);
  const setPopoverFilter = useUIStore((s) => s.setPopoverFilter);
  const setPopoverSelectedIndex = useUIStore((s) => s.setPopoverSelectedIndex);
  const applyPopoverItem = useUIStore((s) => s.applyPopoverItem);
  const closePicker = useUIStore((s) => s.closePicker);
  const setPickerSelectedDate = useUIStore((s) => s.setPickerSelectedDate);
  const applyPickerDate = useUIStore((s) => s.applyPickerDate);

  const config = useConfigStore((s) => s.config);
  const areas = config?.areas ?? EMPTY_AREAS;

  const inputRef = useRef<HTMLInputElement>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const [shaking, setShaking] = useState(false);

  useEffect(() => {
    if (state.open) {
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [state.open]);

  // useEscape closes the whole overlay; while popover/picker is open
  // they own Escape themselves and must shadow this handler.
  useEscape(close, state.open && !state.popoverOpen && !state.pickerOpen);

  if (!state.open) return null;

  const empty = areas.length === 0;
  const isDirection = state.type === "direction";

  const triggerShake = () => {
    setShaking(true);
    window.setTimeout(() => setShaking(false), SHAKE_MS);
  };

  const deactivatedSet = new Set(state.deactivatedSpans);
  const conflict = isConflict(state.tokens, deactivatedSet);

  const submit = async () => {
    if (conflict) {
      triggerShake();
      return;
    }
    const { title, deadline } = tokensToParsed(state.tokens, deactivatedSet);
    if (!title.trim()) {
      triggerShake();
      return;
    }
    if (!isDirection && !state.category) {
      triggerShake();
      return;
    }
    try {
      const category = state.category ?? areas[0]?.id ?? "";
      const entity = await createFromQuickAdd({
        parsed: { title, deadline },
        type: state.type,
        category,
      });
      toast.success(`✓ ${entity.title}`, { category });
    } catch (e) {
      toast.error(errMsg(e));
    }
    close();
  };

  const handleInputChange = (v: string) => {
    setInput(v);
    const lastBang = v.lastIndexOf("!");
    if (lastBang === -1) {
      if (state.popoverOpen) closePopover();
      return;
    }
    const charBefore = lastBang > 0 ? v[lastBang - 1] : "";
    const isWordBoundary = lastBang === 0 || /\s/.test(charBefore);
    const fragment = v.slice(lastBang + 1);
    const fragmentHasSpace = /\s/.test(fragment);
    if (isWordBoundary && !fragmentHasSpace) {
      if (!state.popoverOpen) openPopover(fragment);
      else setPopoverFilter(fragment);
    } else if (state.popoverOpen) {
      closePopover();
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    // IME composition (Chinese/Japanese/Korean): swallow Enter/Escape
    // so the IME's own commit/cancel keystroke isn't hijacked.
    if (e.nativeEvent.isComposing) return;
    if (state.popoverOpen) {
      const items = buildPopoverItems(state.popoverFilter);
      const len = items.length;
      if (len === 0) return;
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setPopoverSelectedIndex((state.popoverSelectedIndex + 1) % len);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setPopoverSelectedIndex(
          (state.popoverSelectedIndex - 1 + len) % len,
        );
        return;
      }
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        applyPopoverItem();
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        closePopover();
        return;
      }
      return;
    }
    if (state.pickerOpen) {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        closePicker();
        return;
      }
      if (e.key === "Enter") {
        e.preventDefault();
        applyPickerDate();
        return;
      }
      let delta = 0;
      if (e.key === "ArrowLeft") delta = -1;
      else if (e.key === "ArrowRight") delta = 1;
      else if (e.key === "ArrowUp") delta = -7;
      else if (e.key === "ArrowDown") delta = 7;
      if (delta !== 0) {
        e.preventDefault();
        const cur = state.pickerSelectedDate ?? formatDate(getStartOfDay());
        const [y, m, d] = cur.split("-").map(Number);
        const date = new Date(y, m - 1, d + delta);
        setPickerSelectedDate(formatDate(date));
        return;
      }
      return;
    }
    if (e.ctrlKey && !e.metaKey && !e.altKey && !e.shiftKey) {
      if (e.code === "Digit1") {
        e.preventDefault();
        setType("task");
        return;
      }
      if (e.code === "Digit2") {
        e.preventDefault();
        setType("project");
        return;
      }
      if (e.code === "Digit3") {
        e.preventDefault();
        setType("direction");
        return;
      }
    }
    if (e.key === "Enter") {
      e.preventDefault();
      void submit();
      return;
    }
    // Tab outside the popover falls through to native focus navigation
    // (input → category dots → segment items). Inside the popover Tab
    // applies the selected item — handled in the popover branch above.
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
      <div
        ref={barRef}
        className={`qa-bar${shaking ? " qa-shake" : ""}`}
      >
        <QuickAddInput
          ref={inputRef}
          value={state.input}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          tokens={state.tokens}
          deactivatedSpans={state.deactivatedSpans}
          conflict={conflict}
          onTokenClick={toggleTokenActive}
          placeholder="Что добавить?"
        />
        <div className="qa-helper">
          <span className="qa-kbd">!</span>
          <span>дата</span>
          <span>·</span>
          <span className="qa-kbd">⌃1</span>
          <span className="qa-kbd">⌃2</span>
          <span className="qa-kbd">⌃3</span>
          <span>тип</span>
          <span>·</span>
          <span className="qa-kbd">esc</span>
          <span>отменить</span>
        </div>
        <QuickAddPreview />
        {state.popoverOpen && <QuickAddPopover />}
        {state.pickerOpen && <QuickAddDatePicker />}
        <div className="qa-footer">
          {isDirection ? (
            <span className="qa-direction-note">
              Направление верхнего уровня
            </span>
          ) : empty ? (
            <span className="qa-direction-note">
              Сначала добавьте области в Settings
            </span>
          ) : (
            <div className="qa-cats">
              <div className="qa-cats-row">
                {areas.map((a) => (
                  <Tooltip
                    key={a.id}
                    content={a.label}
                    delay={0}
                    placement="above"
                  >
                    <button
                      type="button"
                      className={`qa-cat-dot${state.category === a.id ? " on" : ""}`}
                      style={{ background: a.color }}
                      onClick={() => setCategory(a.id)}
                      aria-label={a.label}
                      aria-pressed={state.category === a.id}
                    />
                  </Tooltip>
                ))}
              </div>
              {(() => {
                const active = areas.find((a) => a.id === state.category);
                if (!active) return null;
                return (
                  <span className="qa-cat-active-label">{active.label}</span>
                );
              })()}
            </div>
          )}
          <div className="qa-segment">
            {TYPE_ORDER.map((t) => (
              <button
                key={t}
                type="button"
                className={`qa-segment-item${state.type === t ? " on" : ""}`}
                onClick={() => setType(t)}
                aria-pressed={state.type === t}
              >
                {TYPE_LABEL_RU[t]}
              </button>
            ))}
          </div>
          <span className="qa-kbd">↵</span>
        </div>
      </div>
    </div>
  );
}
