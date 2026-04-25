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
export function KvTable({
  value,
  onChange,
  keyLabel,
  valueLabel,
  defaultValue = 30,
}: Props) {
  const rows = Object.entries(value);

  // Renaming a key has to preserve insertion order so the UI doesn't
  // shuffle rows on edit. Rebuild the map by iterating the existing
  // entries and substituting the new key in place.
  const update = (oldKey: string, newKey: string, newValue: number) => {
    const next: Record<string, number> = {};
    for (const [k, v] of rows) {
      if (k === oldKey) next[newKey] = newValue;
      else next[k] = v;
    }
    onChange(next);
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
      {rows.map(([k, v]) => (
        <div key={k} className="kv-row">
          <input
            className="fi"
            value={k}
            onChange={(e) => update(k, e.target.value, v)}
          />
          <input
            className="fi"
            type="number"
            value={v}
            onChange={(e) =>
              update(k, k, parseInt(e.target.value, 10) || 0)
            }
          />
          <button
            type="button"
            className="editor-x"
            aria-label="Удалить"
            onClick={() => remove(k)}
          >
            ×
          </button>
        </div>
      ))}
      <button type="button" className="editor-add" onClick={add}>
        + Добавить
      </button>
    </div>
  );
}
