import { useEffect, useState, type KeyboardEvent } from "react";
import type { DirectionEntity } from "../../../schemas";
import { useEntityStore } from "../../../store/entities";
import { useAreas } from "../../../store/config";
import { formatDate, getStartOfDay } from "../../../services/time-utils";
import { errMsg } from "../../../services/format";
import { toast } from "../../shared/Toast";

// Surface a failed updateEntity / deleteCascade to the user. See
// BlockPopup for the originating pattern.
const handlePersistError = (e: unknown, reset?: () => void) => {
  toast.error(`Не удалось: ${errMsg(e)}`);
  reset?.();
};

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
    void updateEntity(direction.id, { tags: [...nonArea, id] }).catch((e) =>
      handlePersistError(e),
    );
  };

  const persistTitle = () => {
    const cur = fresh();
    if (!cur) return;
    const t = titleDraft.trim();
    if (t && t !== cur.title) {
      void updateEntity(direction.id, { title: t }).catch((e) =>
        handlePersistError(e, () => setTitleDraft(cur.title)),
      );
    } else {
      setTitleDraft(cur.title);
    }
  };

  // Each persist* compares the parsed draft against the *fresh*
  // current value before writing. Without this, blurring an
  // unchanged field would re-write `cur.fields.X` and clobber a
  // background update that landed while the popup was open.
  //
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
      if (cur.fields.cadence === null && cur.fields.last_act === null) return;
      void updateEntity(direction.id, {
        fields: { ...cur.fields, cadence: null, last_act: null },
      }).catch((e) =>
        handlePersistError(e, () =>
          setCadDraft(cur.fields.cadence?.toString() ?? ""),
        ),
      );
      return;
    }
    const today = formatDate(getStartOfDay());
    const nextLastAct = cur.fields.last_act ?? today;
    if (
      cur.fields.cadence === parsed &&
      cur.fields.last_act === nextLastAct
    ) {
      return;
    }
    void updateEntity(direction.id, {
      fields: {
        ...cur.fields,
        cadence: parsed,
        last_act: nextLastAct,
      },
    }).catch((e) =>
      handlePersistError(e, () =>
        setCadDraft(cur.fields.cadence?.toString() ?? ""),
      ),
    );
  };

  const persistLabel = () => {
    const cur = fresh();
    if (!cur) return;
    const v = labelDraft.trim() || null;
    if (cur.fields.cadence_label === v) return;
    void updateEntity(direction.id, {
      fields: { ...cur.fields, cadence_label: v },
    }).catch((e) =>
      handlePersistError(e, () =>
        setLabelDraft(cur.fields.cadence_label ?? ""),
      ),
    );
  };

  const persistTarget = () => {
    const cur = fresh();
    if (!cur) return;
    const v = targetDraft.trim() || null;
    if (cur.fields.target === v) return;
    void updateEntity(direction.id, {
      fields: { ...cur.fields, target: v },
    }).catch((e) =>
      handlePersistError(e, () => setTargetDraft(cur.fields.target ?? "")),
    );
  };

  const persistCurrent = () => {
    const cur = fresh();
    if (!cur) return;
    const v = currentDraft.trim() || null;
    if (cur.fields.current === v) return;
    void updateEntity(direction.id, {
      fields: { ...cur.fields, current: v },
    }).catch((e) =>
      handlePersistError(e, () => setCurrentDraft(cur.fields.current ?? "")),
    );
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
    try {
      await deleteCascade(direction.id);
      toast.success(`Удалено: ${direction.title}`);
      onClose();
    } catch (e) {
      handlePersistError(e);
    }
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
