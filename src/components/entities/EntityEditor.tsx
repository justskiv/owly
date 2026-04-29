import { useEffect, useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import type {
  Entity,
  EntityType,
  Priority,
  Status,
} from "../../schemas";
import { DirectionFieldsSchema, EntitySchema } from "../../schemas";
import { useConfigStore } from "../../store/config";
import { useEntityStore } from "../../store/entities";
import { useUIStore, type EntityEditorState } from "../../store/ui";
import { useFocusTrap } from "../../hooks/useFocusTrap";
import { useRestoreFocus } from "../../hooks/useRestoreFocus";
import { toast } from "../shared/Toast";
import {
  ENTITY_LABELS_ACC,
  ENTITY_LABELS_RU,
} from "../../services/entity-icons";
import { formatDate } from "../../services/time-utils";
import { TagsField } from "./editor/TagsField";
import { TypeSpecificFields } from "./editor/TypeSpecificFields";

// ---- Default fields per type ---------------------------------------

function defaultFieldsFor(type: EntityType): Entity["fields"] {
  switch (type) {
    case "task":
      return { parent_project_id: null, checklist: [] };
    case "project":
      return {
        description: "",
        pipeline_stage: "research",
        task_ids: [],
        direction_id: null,
        board_id: "brd3",
        column_index: 0,
        last_activity_days: 0,
      };
    case "routine":
      return {
        frequency: "daily",
        days: ["mon", "tue", "wed", "thu", "fri"],
        default_duration: 30,
        default_time: "09:00",
      };
    case "event":
      // Local date, not UTC — toISOString() shifts by timezone and
      // around midnight would land on yesterday/tomorrow.
      return {
        date: formatDate(new Date()),
        time: "12:00",
        duration: 60,
        location: "",
        travel_time: 0,
      };
    case "contact":
      return {
        name: "",
        desired_cadence_days: null,
        last_contact: null,
        travel_time: 0,
        important_dates: [],
        topics: [],
        contact_history: [],
        notes: "",
      };
    case "goal":
      return {
        target: "",
        current_value: "",
        target_date: null,
        linked_metric_ids: [],
      };
    case "metric":
      return {
        unit: "",
        current_value: 0,
        linked_goal_id: null,
        history: [],
      };
    case "note":
      return { body: "" };
    case "direction":
      return DirectionFieldsSchema.parse({});
  }
}

// ---- Form state -----------------------------------------------------

interface FormState {
  type: EntityType;
  title: string;
  tags: string[];
  status: Status;
  priority: Priority;
  deadline: string | null;
  estimatedMinutes: number | null;
  description: string;
  fields: Entity["fields"];
}

function initialForm(
  state: EntityEditorState & { open: true },
  entities: readonly Entity[],
): FormState {
  if (state.mode === "edit") {
    const existing = entities.find((e) => e.id === state.entityId);
    if (existing) {
      return {
        type: existing.type,
        title: existing.title,
        tags: existing.tags,
        status: existing.status,
        priority: existing.priority,
        deadline: existing.deadline,
        estimatedMinutes: existing.estimated_minutes,
        description: existing.description,
        fields: existing.fields,
      };
    }
  }
  const type = state.mode === "new" ? state.type : "task";
  return {
    type,
    title: "",
    tags: [],
    status: "active",
    priority: null,
    deadline: null,
    estimatedMinutes: null,
    description: "",
    fields: defaultFieldsFor(type),
  };
}

// ---- Component ------------------------------------------------------

interface Props {
  state: EntityEditorState & { open: true };
}

export function EntityEditor({ state }: Props) {
  const isEdit = state.mode === "edit";
  const entities = useEntityStore((s) => s.entities);
  const areas = useConfigStore((s) => s.config?.areas) ?? [];
  const pipelineStages =
    useConfigStore((s) => s.config?.pipeline_stages) ?? [];
  const close = useUIStore((s) => s.closeEntityEditor);
  const setSelected = useUIStore((s) => s.setSelectedEntity);
  const setPage = useUIStore((s) => s.setPage);

  const [form, setForm] = useState<FormState>(() => initialForm(state, entities));
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const titleRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  useFocusTrap(dialogRef, true);
  useRestoreFocus(true);

  useEffect(() => {
    titleRef.current?.focus();
    titleRef.current?.select();
  }, []);

  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [close]);

  useEffect(() => {
    if (!confirmingDelete) return;
    const t = window.setTimeout(() => setConfirmingDelete(false), 3000);
    return () => window.clearTimeout(t);
  }, [confirmingDelete]);

  const patch = (u: Partial<FormState>) => setForm((p) => ({ ...p, ...u }));

  const handleSave = async () => {
    const title = form.title.trim();
    if (!title) {
      toast.error("Название не может быть пустым");
      return;
    }
    if (form.estimatedMinutes != null && form.estimatedMinutes < 30) {
      toast.error("Минимальная оценка — 30 минут");
      return;
    }
    // We build a throwaway created_at/updated_at — addEntity will
    // override them. For edit, updateEntity will refresh updated_at.
    const nowStub = "1970-01-01T00:00:00";
    const candidate = {
      type: form.type,
      id: isEdit ? state.entityId : "tmp",
      title,
      tags: form.tags,
      status: form.status,
      priority: form.priority,
      deadline: form.deadline,
      estimated_minutes: form.estimatedMinutes,
      description: form.description,
      created_at: nowStub,
      updated_at: nowStub,
      fields: form.fields,
    };
    const parsed = EntitySchema.safeParse(candidate);
    if (!parsed.success) {
      const msg = parsed.error.issues
        .map(
          (i) =>
            `${i.path.join(".") || "(root)"}: ${i.message}`,
        )
        .join("; ");
      toast.error(`Ошибка: ${msg}`);
      return;
    }

    try {
      if (isEdit) {
        await useEntityStore.getState().updateEntity(state.entityId, {
          title,
          tags: form.tags,
          status: form.status,
          priority: form.priority,
          deadline: form.deadline,
          estimated_minutes: form.estimatedMinutes,
          description: form.description,
          fields: form.fields,
        } as Partial<Entity>);
        toast.success(`✓ Обновлено: ${title}`, { category: form.tags[0] });
      } else {
        const { id: _id, created_at: _c, updated_at: _u, ...rest } = parsed.data;
        void _id;
        void _c;
        void _u;
        const created = await useEntityStore
          .getState()
          .addEntity(rest as Omit<Entity, "id" | "created_at" | "updated_at">);
        toast.success(`✓ Создано: ${title}`, { category: created.tags[0] });
        setSelected(created.id);
        setPage("entities");
      }
      close();
    } catch (e) {
      toast.error(`Не удалось сохранить: ${(e as Error).message}`);
    }
  };

  const handleDelete = async () => {
    if (!isEdit) return;
    if (!confirmingDelete) {
      setConfirmingDelete(true);
      return;
    }
    try {
      // Resolve the CURRENT-on-disk title, not the draft the user
      // may have just typed — the toast should name what they see
      // in the list on the left, not an unsaved edit.
      const existing = useEntityStore
        .getState()
        .entities.find((e) => e.id === state.entityId);
      const title = existing?.title ?? form.title;
      await useEntityStore.getState().deleteEntity(state.entityId);
      setSelected(null);
      toast.success(`✕ Удалён: ${title}`, { category: form.tags[0] });
      close();
    } catch (e) {
      toast.error(`Не удалось удалить: ${(e as Error).message}`);
    }
  };

  const onTopFieldEnter = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      void handleSave();
    }
  };

  const onTypeChange = (t: EntityType) => {
    if (t === form.type) return;
    // Type-specific fields can't be cross-converted, so they reset to
    // defaults — which would silently wipe a 10-minute contact form
    // if the user grazes the select. Ask first if the draft has any
    // data worth losing; edit-mode disables the select entirely so
    // only "new" flows hit this path.
    const hasDraftData =
      form.title.trim().length > 0 ||
      form.description.trim().length > 0 ||
      form.tags.length > 0;
    if (hasDraftData) {
      const ok = window.confirm(
        "Сменить тип? Данные подтипа (чеклисты, темы, история и т.п.) сбросятся.",
      );
      if (!ok) return;
    }
    patch({ type: t, fields: defaultFieldsFor(t) });
  };

  return (
    <div className="modal-bg visible" onMouseDown={close}>
      <div
        ref={dialogRef}
        className="modal entity-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="ee-title"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="m-head">
          <span id="ee-title" className="m-title">
            {isEdit
              ? `Редактировать ${ENTITY_LABELS_RU[form.type]}`
              : `Создать ${ENTITY_LABELS_ACC[form.type]}`}
          </span>
          <button
            type="button"
            className="m-close"
            onClick={close}
            aria-label="Закрыть"
          >
            ×
          </button>
        </div>
        <div className="m-body">
          <div className="fg">
            <label className="fl" htmlFor="ee-title-input">
              Название *
            </label>
            <input
              id="ee-title-input"
              ref={titleRef}
              className="fi"
              value={form.title}
              onChange={(e) => patch({ title: e.target.value })}
              onKeyDown={onTopFieldEnter}
            />
          </div>

          {!isEdit && (
            <div className="fg">
              <label className="fl">Тип</label>
              <select
                className="fi"
                value={form.type}
                onChange={(e) => onTypeChange(e.target.value as EntityType)}
              >
                <option value="task">Задача</option>
                <option value="project">Проект</option>
                <option value="routine">Рутина</option>
                <option value="event">Событие</option>
                <option value="contact">Контакт</option>
                <option value="goal">Цель</option>
                <option value="metric">Метрика</option>
                <option value="note">Заметка</option>
                <option value="direction">Направление</option>
              </select>
            </div>
          )}

          <TagsField
            tags={form.tags}
            onChange={(tags) => patch({ tags })}
            areas={areas}
          />

          <div className="f-row">
            <div className="fg">
              <label className="fl">Статус</label>
              <select
                className="fi"
                value={form.status}
                onChange={(e) =>
                  patch({ status: e.target.value as Status })
                }
              >
                <option value="active">Active</option>
                <option value="someday">Someday</option>
                <option value="done">Done</option>
                <option value="archived">Archived</option>
              </select>
            </div>
            <div className="fg">
              <label className="fl">Приоритет</label>
              <select
                className="fi"
                value={form.priority ?? ""}
                onChange={(e) =>
                  patch({
                    priority: (e.target.value || null) as Priority,
                  })
                }
              >
                <option value="">— нет —</option>
                <option value="high">HIGH</option>
                <option value="medium">MEDIUM</option>
                <option value="low">LOW</option>
              </select>
            </div>
            <div className="fg">
              <label className="fl">Дедлайн</label>
              <input
                type="date"
                className="fi"
                value={form.deadline ?? ""}
                onChange={(e) =>
                  patch({ deadline: e.target.value || null })
                }
              />
            </div>
            <div className="fg">
              <label className="fl">Оценка (мин)</label>
              <input
                type="number"
                min={1}
                className="fi"
                style={{ fontFamily: "var(--mono)" }}
                value={form.estimatedMinutes ?? ""}
                onChange={(e) =>
                  patch({
                    estimatedMinutes: e.target.value
                      ? Number(e.target.value)
                      : null,
                  })
                }
              />
            </div>
          </div>

          {form.type !== "note" && (
            <div className="fg">
              <label className="fl">Описание</label>
              <textarea
                className="fi"
                rows={3}
                value={form.description}
                onChange={(e) => patch({ description: e.target.value })}
              />
            </div>
          )}

          <TypeSpecificFields
            type={form.type}
            fields={form.fields}
            onChange={(fields) => patch({ fields })}
            entities={entities}
            pipelineStages={pipelineStages}
          />
        </div>
        <div className="m-foot">
          {isEdit ? (
            <button
              type="button"
              className={`btn-del${confirmingDelete ? " confirm" : ""}`}
              onClick={handleDelete}
            >
              {confirmingDelete ? "Точно удалить?" : "Удалить"}
            </button>
          ) : (
            <span />
          )}
          <button type="button" className="btn-save" onClick={handleSave}>
            Сохранить
          </button>
        </div>
      </div>
    </div>
  );
}
