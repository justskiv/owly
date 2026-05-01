import { useEffect, useRef, useState } from "react";
import type { FormEvent, MouseEvent } from "react";
import type { Priority } from "../../schemas";
import { TaskFieldsSchema } from "../../schemas/entity";
import { useUIStore } from "../../store/ui";
import { useEntityStore } from "../../store/entities";
import { usePoolStore } from "../../store/pool";
import { useConfigStore } from "../../store/config";
import { useEscape } from "../../hooks/useEscape";
import { toast } from "../shared/Toast";

export function PoolAddModal() {
  const modal = useUIStore((s) => s.poolModalOpen);
  const close = useUIStore((s) => s.closePoolModal);

  useEscape(close, modal !== null);

  if (modal === null) return null;
  return (
    <div
      className="modal-overlay"
      onMouseDown={(e: MouseEvent) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <div className="modal" role="dialog" aria-modal="true">
        {modal === "new-task" ? (
          <NewTaskForm onClose={close} />
        ) : (
          <NewPoolItemForm onClose={close} />
        )}
      </div>
    </div>
  );
}

const EMPTY_AREAS: never[] = [];

function NewTaskForm({ onClose }: { onClose: () => void }) {
  const config = useConfigStore((s) => s.config);
  const areas = config?.areas ?? EMPTY_AREAS;
  const addEntity = useEntityStore((s) => s.addEntity);
  const titleRef = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState(areas[0]?.id ?? "work");
  const [priority, setPriority] = useState<Priority>("medium");
  const [deadline, setDeadline] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    requestAnimationFrame(() => titleRef.current?.focus());
  }, []);

  const submit = async (e?: FormEvent) => {
    e?.preventDefault();
    const t = title.trim();
    if (!t || submitting) return;
    setSubmitting(true);
    try {
      const ent = await addEntity({
        type: "task",
        title: t,
        tags: [category],
        status: "active",
        priority,
        deadline: deadline || null,
        estimated_minutes: null,
        description: "",
        fields: TaskFieldsSchema.parse({ parent_project_id: null }),
      });
      toast.success(`✓ ${ent.title}`, { category });
      onClose();
    } catch (err) {
      toast.error((err as Error).message);
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={submit}>
      <h3>Новая задача</h3>
      <label htmlFor="ntm-title">Название</label>
      <input
        ref={titleRef}
        id="ntm-title"
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        maxLength={200}
        required
      />
      <label htmlFor="ntm-cat">Категория</label>
      <select
        id="ntm-cat"
        value={category}
        onChange={(e) => setCategory(e.target.value)}
      >
        {areas.map((a) => (
          <option key={a.id} value={a.id}>
            {a.label}
          </option>
        ))}
      </select>
      <label htmlFor="ntm-prio">Приоритет</label>
      <select
        id="ntm-prio"
        value={priority ?? ""}
        onChange={(e) => setPriority((e.target.value || null) as Priority)}
      >
        <option value="high">Высокий</option>
        <option value="medium">Средний</option>
        <option value="low">Низкий</option>
        <option value="">—</option>
      </select>
      <label htmlFor="ntm-deadline">Дедлайн</label>
      <input
        id="ntm-deadline"
        type="date"
        value={deadline}
        onChange={(e) => setDeadline(e.target.value)}
      />
      <div className="modal-actions">
        <button
          type="button"
          className="btn-cancel"
          onClick={onClose}
          disabled={submitting}
        >
          Отмена
        </button>
        <button
          type="submit"
          className="btn-primary"
          disabled={!title.trim() || submitting}
        >
          Создать
        </button>
      </div>
    </form>
  );
}

function NewPoolItemForm({ onClose }: { onClose: () => void }) {
  const config = useConfigStore((s) => s.config);
  const areas = config?.areas ?? EMPTY_AREAS;
  const addItem = usePoolStore((s) => s.addItem);
  const titleRef = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState("");
  const [hours, setHours] = useState("1");
  const [category, setCategory] = useState(areas[0]?.id ?? "work");
  const [splittable, setSplittable] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    requestAnimationFrame(() => titleRef.current?.focus());
  }, []);

  const submit = async (e?: FormEvent) => {
    e?.preventDefault();
    const t = title.trim();
    const h = parseFloat(hours);
    if (!t || !Number.isFinite(h) || h <= 0 || submitting) return;
    setSubmitting(true);
    try {
      const item = await addItem({
        title: t,
        hours: h,
        category,
        splittable,
        source_entity_id: null,
        source_kind: "ad-hoc",
        placed: false,
      });
      toast.success(`В пул: ${item.title}`, { category });
      onClose();
    } catch (err) {
      toast.error((err as Error).message);
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={submit}>
      <h3>В пул недели</h3>
      <label htmlFor="npm-title">Название</label>
      <input
        ref={titleRef}
        id="npm-title"
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        maxLength={200}
        required
      />
      <label htmlFor="npm-hours">Часы</label>
      <input
        id="npm-hours"
        type="number"
        min={0.5}
        step={0.5}
        value={hours}
        onChange={(e) => setHours(e.target.value)}
        required
      />
      <label htmlFor="npm-cat">Категория</label>
      <select
        id="npm-cat"
        value={category}
        onChange={(e) => setCategory(e.target.value)}
      >
        {areas.map((a) => (
          <option key={a.id} value={a.id}>
            {a.label}
          </option>
        ))}
      </select>
      <label>Тип</label>
      <div className="toggle-row">
        <button
          type="button"
          className={"toggle-btn" + (splittable ? " on" : "")}
          onClick={() => setSplittable(true)}
        >
          Дробимый
        </button>
        <button
          type="button"
          className={"toggle-btn" + (!splittable ? " on" : "")}
          onClick={() => setSplittable(false)}
        >
          Атомарный
        </button>
      </div>
      <div className="modal-actions">
        <button
          type="button"
          className="btn-cancel"
          onClick={onClose}
          disabled={submitting}
        >
          Отмена
        </button>
        <button
          type="submit"
          className="btn-primary"
          disabled={!title.trim() || !(parseFloat(hours) > 0) || submitting}
        >
          Создать
        </button>
      </div>
    </form>
  );
}
