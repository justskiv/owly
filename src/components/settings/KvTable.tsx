import { useEffect, useState } from "react";

interface Props {
  value: Record<string, number>;
  onChange: (next: Record<string, number>) => void;
  keyLabel: string;
  valueLabel: string;
  defaultValue?: number;
}

// Editor for a Record<string, number> where keys are user-defined
// labels (e.g. "podcast_recording") and values are minute counts.
// Used for scheduling_preferences.min_block_duration and .buffer_after.
//
// Why the per-row component + draft state: editing the key field
// in place would either remount the row on every keystroke (if the
// key were the React key) or silently merge two rows when typing
// transiently lands on an existing key. Local draft + commit-on-
// blur lets the user type freely and surfaces the canonical
// behavior (revert on collision/empty) only at the boundary.
export function KvTable({
  value,
  onChange,
  keyLabel,
  valueLabel,
  defaultValue = 30,
}: Props) {
  const rows = Object.entries(value);
  const allKeys = new Set(rows.map(([k]) => k));

  const renameKey = (oldKey: string, newKey: string): boolean => {
    if (newKey === oldKey) return true;
    if (!newKey.trim()) return false;
    if (newKey in value) return false;
    const next: Record<string, number> = {};
    for (const [k, v] of rows) {
      if (k === oldKey) next[newKey] = v;
      else next[k] = v;
    }
    onChange(next);
    return true;
  };

  const updateValue = (k: string, n: number) => {
    onChange({ ...value, [k]: n });
  };

  const remove = (k: string) => {
    const next = { ...value };
    delete next[k];
    onChange(next);
  };

  const add = () => {
    let k = "новое";
    let n = 1;
    while (k in value) k = `новое-${n++}`;
    onChange({ ...value, [k]: defaultValue });
  };

  return (
    <div className="kv-table">
      <div className="kv-head">
        <span>{keyLabel}</span>
        <span>{valueLabel}</span>
        <span></span>
      </div>
      {rows.map(([k, v], idx) => (
        // Index key is intentional: rebuilding the array preserves
        // order, so a row's index is stable across renames. Using
        // the editable key as React key would remount the input on
        // every keystroke and lose focus.
        <Row
          key={idx}
          k={k}
          v={v}
          allKeys={allKeys}
          onCommitKey={renameKey}
          onChangeValue={(n) => updateValue(k, n)}
          onRemove={() => remove(k)}
        />
      ))}
      <button type="button" className="editor-add" onClick={add}>
        + Добавить
      </button>
    </div>
  );
}

interface RowProps {
  k: string;
  v: number;
  allKeys: Set<string>;
  onCommitKey: (oldKey: string, newKey: string) => boolean;
  onChangeValue: (n: number) => void;
  onRemove: () => void;
}

function Row({
  k,
  v,
  allKeys,
  onCommitKey,
  onChangeValue,
  onRemove,
}: RowProps) {
  const [draft, setDraft] = useState(k);

  // Sync only when the canonical key actually changes (e.g. parent
  // committed a different rename). Local edits stay in draft.
  useEffect(() => {
    setDraft(k);
  }, [k]);

  const commit = () => {
    const trimmed = draft.trim();
    if (trimmed === k) return;
    const ok = onCommitKey(k, trimmed);
    if (!ok) {
      // Collision or empty — revert visible draft so the user sees
      // why the rename was rejected instead of an inconsistent state.
      setDraft(k);
    }
  };

  const collision =
    draft.trim() !== k &&
    (draft.trim() === "" || allKeys.has(draft.trim()));

  return (
    <div className="kv-row">
      <input
        className={`fi${collision ? " kv-key-bad" : ""}`}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          if (e.key === "Escape") {
            setDraft(k);
            (e.target as HTMLInputElement).blur();
          }
        }}
        title={
          collision ? "Имя пустое или уже занято — будет отменено" : undefined
        }
      />
      <input
        className="fi"
        type="number"
        value={v}
        onChange={(e) => onChangeValue(parseInt(e.target.value, 10) || 0)}
      />
      <button
        type="button"
        className="editor-x"
        aria-label="Удалить"
        onClick={onRemove}
      >
        ×
      </button>
    </div>
  );
}
