import { useEffect, useState, type KeyboardEvent } from "react";
import type { DirectionEntity } from "../../../schemas";
import { useEntityStore } from "../../../store/entities";
import { useAreas } from "../../../store/config";
import { formatDate, getStartOfDay } from "../../../services/time-utils";
import { toast } from "../../shared/Toast";

interface Props {
  direction: DirectionEntity;
  onClose: () => void;
}

function TrashIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 12 12"
      fill="none"
      aria-hidden
    >
      <path
        d="M2 3h8M4.5 3V2a.5.5 0 0 1 .5-.5h2a.5.5 0 0 1 .5.5v1M5 5.5v3M7 5.5v3M3 3l.5 7a1 1 0 0 0 1 1h3a1 1 0 0 0 1-1L9 3"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function DirectionPopup({ direction, onClose }: Props) {
  const updateEntity = useEntityStore((s) => s.updateEntity);
  const deleteCascade = useEntityStore((s) => s.deleteDirectionWithCascade);
  const areas = useAreas();
  const [titleDraft, setTitleDraft] = useState(direction.title);
  const [cadDraft, setCadDraft] = useState(
    direction.fields.cadence?.toString() ?? "",
  );
  const [labelDraft, setLabelDraft] = useState(
    direction.fields.cadence_label ?? "",
  );
  const [targetDraft, setTargetDraft] = useState(direction.fields.target ?? "");
  const [currentDraft, setCurrentDraft] = useState(
    direction.fields.current ?? "",
  );

  // Reset drafts only when the popup is reused for a different
  // direction. Resetting on every prop change would clobber typing
  // during persist round-trips (same pattern as ProjectPopup).
  useEffect(() => {
    setTitleDraft(direction.title);
    setCadDraft(direction.fields.cadence?.toString() ?? "");
    setLabelDraft(direction.fields.cadence_label ?? "");
    setTargetDraft(direction.fields.target ?? "");
    setCurrentDraft(direction.fields.current ?? "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [direction.id]);

  // Read fresh entity at write time. The `direction` prop is a closure
  // snapshot; a quick succession of edits would otherwise spread stale
  // fields on the second writer and clobber the first.
  const fresh = (): DirectionEntity | null => {
    const e = useEntityStore
      .getState()
      .entities.find((x) => x.id === direction.id);
    return e && e.type === "direction" ? e : null;
  };

  const areaIds = new Set(areas.map((a) => a.id));
  const activeCat = direction.tags.find((t) => areaIds.has(t)) ?? null;

  const setCategory = (id: string) => {
    const cur = fresh();
    if (!cur) return;
    const nonArea = cur.tags.filter((t) => !areaIds.has(t));
    void updateEntity(direction.id, { tags: [...nonArea, id] });
  };

  const persistTitle = () => {
    const t = titleDraft.trim();
    if (t && t !== direction.title) {
      void updateEntity(direction.id, { title: t });
    } else {
      setTitleDraft(direction.title);
    }
  };

  // Cadence transitions:
  //   "" / 0  → cadence:null, last_act:null      (disable)
  //   N>0     → cadence:N; if last_act was null, set today (avoid
  //             NaN urgency on the very next render — see spec 3.1).
  const persistCadence = () => {
    const cur = fresh();
    if (!cur) return;
    const raw = cadDraft.trim();
    const parsed = raw === "" ? 0 : parseInt(raw, 10);
    if (!Number.isFinite(parsed)) {
      setCadDraft(cur.fields.cadence?.toString() ?? "");
      return;
    }
    if (parsed <= 0) {
      void updateEntity(direction.id, {
        fields: { ...cur.fields, cadence: null, last_act: null },
      });
      return;
    }
    const today = formatDate(getStartOfDay());
    void updateEntity(direction.id, {
      fields: {
        ...cur.fields,
        cadence: parsed,
        last_act: cur.fields.last_act ?? today,
      },
    });
  };

  const persistLabel = () => {
    const cur = fresh();
    if (!cur) return;
    const v = labelDraft.trim();
    void updateEntity(direction.id, {
      fields: { ...cur.fields, cadence_label: v || null },
    });
  };

  const persistTarget = () => {
    const cur = fresh();
    if (!cur) return;
    const v = targetDraft.trim();
    void updateEntity(direction.id, {
      fields: { ...cur.fields, target: v || null },
    });
  };

  const persistCurrent = () => {
    const cur = fresh();
    if (!cur) return;
    const v = currentDraft.trim();
    void updateEntity(direction.id, {
      fields: { ...cur.fields, current: v || null },
    });
  };

  const onTitleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.nativeEvent.isComposing) return;
    if (e.key === "Enter") {
      e.preventDefault();
      (e.target as HTMLInputElement).blur();
    }
  };

  const onInputKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.nativeEvent.isComposing) return;
    if (e.key === "Enter") {
      e.preventDefault();
      (e.target as HTMLInputElement).blur();
    }
  };

  const onDelete = async () => {
    await deleteCascade(direction.id);
    toast.success(`Удалено: ${direction.title}`);
    onClose();
  };

  return (
    <div className="ep-task" role="document">
      <div className="ep-task-head">
        <input
          className="ep-title"
          value={titleDraft}
          onChange={(e) => setTitleDraft(e.target.value)}
          onBlur={persistTitle}
          onKeyDown={onTitleKeyDown}
          aria-label="Название направления"
          maxLength={200}
        />
        <button
          type="button"
          className="ep-close"
          onClick={onClose}
          aria-label="Закрыть"
        >
          ×
        </button>
      </div>

      <div className="ep-field">
        <div className="ep-label">Категория</div>
        <div className="ep-cat-dots">
          {areas.map((a) => (
            <button
              key={a.id}
              type="button"
              className={`ep-cat-dot${activeCat === a.id ? " on" : ""}`}
              style={{ background: a.color }}
              onClick={() => setCategory(a.id)}
              aria-label={a.label}
              aria-pressed={activeCat === a.id}
              title={a.label}
            />
          ))}
        </div>
      </div>

      <div className="ep-field">
        <div className="ep-label">Каденция (дни, 0 = выкл)</div>
        <input
          type="number"
          className="ep-input"
          min={0}
          value={cadDraft}
          onChange={(e) => setCadDraft(e.target.value)}
          onBlur={persistCadence}
          onKeyDown={onInputKeyDown}
          placeholder="0"
        />
      </div>

      <div className="ep-field">
        <div className="ep-label">Метка каденции</div>
        <input
          type="text"
          className="ep-input"
          value={labelDraft}
          onChange={(e) => setLabelDraft(e.target.value)}
          onBlur={persistLabel}
          onKeyDown={onInputKeyDown}
          placeholder="1×/нед"
          maxLength={50}
        />
      </div>

      <div className="ep-field">
        <div className="ep-label">Цель</div>
        <input
          type="text"
          className="ep-input"
          value={targetDraft}
          onChange={(e) => setTargetDraft(e.target.value)}
          onBlur={persistTarget}
          onKeyDown={onInputKeyDown}
          placeholder="—"
          maxLength={100}
        />
      </div>

      <div className="ep-field">
        <div className="ep-label">Текущее</div>
        <input
          type="text"
          className="ep-input"
          value={currentDraft}
          onChange={(e) => setCurrentDraft(e.target.value)}
          onBlur={persistCurrent}
          onKeyDown={onInputKeyDown}
          placeholder="—"
          maxLength={100}
        />
      </div>

      <div className="ep-actions">
        <button type="button" className="ep-delete" onClick={onDelete}>
          <TrashIcon />
          <span>Удалить</span>
        </button>
      </div>
    </div>
  );
}
