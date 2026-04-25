import type {
  ContactFields,
  DayOfWeek,
  Entity,
  EntityType,
  EventFields,
  GoalFields,
  MetricFields,
  NoteFields,
  ProjectFields,
  RoutineFields,
  RoutineFrequency,
  TaskFields,
} from "../../../schemas";
import { ChecklistEditor } from "./ChecklistEditor";
import { TopicsEditor } from "./TopicsEditor";
import { ImportantDatesEditor } from "./ImportantDatesEditor";
import { HistoryEditor } from "./HistoryEditor";

const DAYS: DayOfWeek[] = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
const DAYS_RU: Record<DayOfWeek, string> = {
  mon: "Пн",
  tue: "Вт",
  wed: "Ср",
  thu: "Чт",
  fri: "Пт",
  sat: "Сб",
  sun: "Вс",
};

interface Props {
  type: EntityType;
  // Fields is a union across all entity types; the dispatching switch
  // below narrows it once per branch and hands a strictly-typed prop
  // to the sub-editor — sub-editors are then cast-free.
  fields: Entity["fields"];
  onChange: (fields: Entity["fields"]) => void;
  entities: readonly Entity[];
  pipelineStages: readonly string[];
}

export function TypeSpecificFields(props: Props) {
  switch (props.type) {
    case "task":
      return (
        <TaskFieldsEditor
          fields={props.fields as TaskFields}
          onChange={props.onChange as (f: TaskFields) => void}
          entities={props.entities}
        />
      );
    case "project":
      return (
        <ProjectFieldsEditor
          fields={props.fields as ProjectFields}
          onChange={props.onChange as (f: ProjectFields) => void}
          pipelineStages={props.pipelineStages}
        />
      );
    case "routine":
      return (
        <RoutineFieldsEditor
          fields={props.fields as RoutineFields}
          onChange={props.onChange as (f: RoutineFields) => void}
        />
      );
    case "event":
      return (
        <EventFieldsEditor
          fields={props.fields as EventFields}
          onChange={props.onChange as (f: EventFields) => void}
        />
      );
    case "contact":
      return (
        <ContactFieldsEditor
          fields={props.fields as ContactFields}
          onChange={props.onChange as (f: ContactFields) => void}
        />
      );
    case "goal":
      return (
        <GoalFieldsEditor
          fields={props.fields as GoalFields}
          onChange={props.onChange as (f: GoalFields) => void}
          entities={props.entities}
        />
      );
    case "metric":
      return (
        <MetricFieldsEditor
          fields={props.fields as MetricFields}
          onChange={props.onChange as (f: MetricFields) => void}
          entities={props.entities}
        />
      );
    case "note":
      return (
        <NoteFieldsEditor
          fields={props.fields as NoteFields}
          onChange={props.onChange as (f: NoteFields) => void}
        />
      );
  }
}

// ---- Task -----------------------------------------------------------

function TaskFieldsEditor({
  fields,
  onChange,
  entities,
}: {
  fields: TaskFields;
  onChange: (f: TaskFields) => void;
  entities: readonly Entity[];
}) {
  const projects = entities.filter((e) => e.type === "project");
  return (
    <div className="type-specific">
      <div className="fg">
        <label className="fl">Родительский проект</label>
        <select
          className="fi"
          value={fields.parent_project_id ?? ""}
          onChange={(e) =>
            onChange({
              ...fields,
              parent_project_id: e.target.value || null,
            })
          }
        >
          <option value="">— нет —</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.title}
            </option>
          ))}
        </select>
      </div>
      <ChecklistEditor
        items={fields.checklist}
        onChange={(checklist) => onChange({ ...fields, checklist })}
      />
    </div>
  );
}

// ---- Project --------------------------------------------------------

function ProjectFieldsEditor({
  fields,
  onChange,
  pipelineStages,
}: {
  fields: ProjectFields;
  onChange: (f: ProjectFields) => void;
  pipelineStages: readonly string[];
}) {
  return (
    <div className="type-specific">
      <div className="fg">
        <label className="fl">Описание</label>
        <textarea
          className="fi"
          rows={3}
          value={fields.description}
          onChange={(e) =>
            onChange({ ...fields, description: e.target.value })
          }
        />
      </div>
      <div className="fg">
        <label className="fl">Стадия пайплайна</label>
        <select
          className="fi"
          value={fields.pipeline_stage}
          onChange={(e) =>
            onChange({ ...fields, pipeline_stage: e.target.value })
          }
        >
          {pipelineStages.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

// ---- Routine --------------------------------------------------------

function RoutineFieldsEditor({
  fields,
  onChange,
}: {
  fields: RoutineFields;
  onChange: (f: RoutineFields) => void;
}) {
  const toggleDay = (d: DayOfWeek) => {
    const next = fields.days.includes(d)
      ? fields.days.filter((x) => x !== d)
      : [...fields.days, d];
    onChange({ ...fields, days: next });
  };
  return (
    <div className="type-specific">
      <div className="fg">
        <label className="fl">Частота</label>
        <select
          className="fi"
          value={fields.frequency}
          onChange={(e) =>
            onChange({
              ...fields,
              frequency: e.target.value as RoutineFrequency,
            })
          }
        >
          <option value="daily">Ежедневно</option>
          <option value="weekly">Еженедельно</option>
          <option value="custom">Настраиваемо</option>
        </select>
      </div>
      <div className="fg">
        <label className="fl">Дни недели</label>
        <div className="chip-row">
          {DAYS.map((d) => (
            <button
              key={d}
              type="button"
              className={`chip${fields.days.includes(d) ? " active" : ""}`}
              onClick={() => toggleDay(d)}
            >
              {DAYS_RU[d]}
            </button>
          ))}
        </div>
      </div>
      <div className="f-row">
        <div className="fg">
          <label className="fl">Длит. (мин)</label>
          <input
            type="number"
            className="fi"
            style={{ fontFamily: "var(--mono)" }}
            value={fields.default_duration}
            onChange={(e) =>
              onChange({
                ...fields,
                default_duration: Math.max(15, Number(e.target.value) || 30),
              })
            }
          />
        </div>
        <div className="fg">
          <label className="fl">Время</label>
          <input
            className="fi"
            style={{ fontFamily: "var(--mono)" }}
            value={fields.default_time}
            onChange={(e) =>
              onChange({ ...fields, default_time: e.target.value })
            }
          />
        </div>
      </div>
    </div>
  );
}

// ---- Event ----------------------------------------------------------

function EventFieldsEditor({
  fields,
  onChange,
}: {
  fields: EventFields;
  onChange: (f: EventFields) => void;
}) {
  return (
    <div className="type-specific">
      <div className="f-row">
        <div className="fg">
          <label className="fl">Дата</label>
          <input
            type="date"
            className="fi"
            value={fields.date}
            onChange={(e) => onChange({ ...fields, date: e.target.value })}
          />
        </div>
        <div className="fg">
          <label className="fl">Время</label>
          <input
            className="fi"
            style={{ fontFamily: "var(--mono)" }}
            value={fields.time}
            onChange={(e) => onChange({ ...fields, time: e.target.value })}
          />
        </div>
        <div className="fg">
          <label className="fl">Длит. (мин)</label>
          <input
            type="number"
            className="fi"
            style={{ fontFamily: "var(--mono)" }}
            value={fields.duration}
            onChange={(e) =>
              onChange({
                ...fields,
                duration: Math.max(15, Number(e.target.value) || 30),
              })
            }
          />
        </div>
      </div>
      <div className="fg">
        <label className="fl">Место</label>
        <input
          className="fi"
          value={fields.location}
          onChange={(e) => onChange({ ...fields, location: e.target.value })}
        />
      </div>
      <div className="fg">
        <label className="fl">Дорога (мин, в одну сторону)</label>
        <input
          type="number"
          className="fi"
          style={{ fontFamily: "var(--mono)" }}
          value={fields.travel_time}
          onChange={(e) =>
            onChange({
              ...fields,
              travel_time: Math.max(0, Number(e.target.value) || 0),
            })
          }
        />
      </div>
    </div>
  );
}

// ---- Contact --------------------------------------------------------

function ContactFieldsEditor({
  fields,
  onChange,
}: {
  fields: ContactFields;
  onChange: (f: ContactFields) => void;
}) {
  return (
    <div className="type-specific">
      <div className="fg">
        <label className="fl">Имя</label>
        <input
          className="fi"
          value={fields.name}
          onChange={(e) => onChange({ ...fields, name: e.target.value })}
        />
      </div>
      <div className="f-row">
        <div className="fg">
          <label className="fl">Частота (дни)</label>
          <input
            type="number"
            className="fi"
            style={{ fontFamily: "var(--mono)" }}
            value={fields.desired_cadence_days ?? ""}
            onChange={(e) =>
              onChange({
                ...fields,
                desired_cadence_days: e.target.value
                  ? Math.max(1, Number(e.target.value))
                  : null,
              })
            }
          />
        </div>
        <div className="fg">
          <label className="fl">Последний контакт</label>
          <input
            type="date"
            className="fi"
            value={fields.last_contact ?? ""}
            onChange={(e) =>
              onChange({
                ...fields,
                last_contact: e.target.value || null,
              })
            }
          />
        </div>
        <div className="fg">
          <label className="fl">Дорога (мин)</label>
          <input
            type="number"
            className="fi"
            style={{ fontFamily: "var(--mono)" }}
            value={fields.travel_time}
            onChange={(e) =>
              onChange({
                ...fields,
                travel_time: Math.max(0, Number(e.target.value) || 0),
              })
            }
          />
        </div>
      </div>
      <TopicsEditor
        topics={fields.topics}
        onChange={(topics) => onChange({ ...fields, topics })}
      />
      <ImportantDatesEditor
        dates={fields.important_dates}
        onChange={(important_dates) =>
          onChange({ ...fields, important_dates })
        }
      />
      <div className="fg">
        <label className="fl">Заметки</label>
        <textarea
          className="fi"
          rows={3}
          value={fields.notes}
          onChange={(e) => onChange({ ...fields, notes: e.target.value })}
        />
      </div>
    </div>
  );
}

// ---- Goal -----------------------------------------------------------

function GoalFieldsEditor({
  fields,
  onChange,
  entities,
}: {
  fields: GoalFields;
  onChange: (f: GoalFields) => void;
  entities: readonly Entity[];
}) {
  const metrics = entities.filter((e) => e.type === "metric");
  const toggleMetric = (id: string) => {
    const next = fields.linked_metric_ids.includes(id)
      ? fields.linked_metric_ids.filter((x) => x !== id)
      : [...fields.linked_metric_ids, id];
    onChange({ ...fields, linked_metric_ids: next });
  };
  return (
    <div className="type-specific">
      <div className="f-row">
        <div className="fg">
          <label className="fl">Цель (значение)</label>
          <input
            className="fi"
            value={fields.target}
            onChange={(e) => onChange({ ...fields, target: e.target.value })}
          />
        </div>
        <div className="fg">
          <label className="fl">Текущее</label>
          <input
            className="fi"
            value={fields.current_value}
            onChange={(e) =>
              onChange({ ...fields, current_value: e.target.value })
            }
          />
        </div>
        <div className="fg">
          <label className="fl">Дедлайн</label>
          <input
            type="date"
            className="fi"
            value={fields.target_date ?? ""}
            onChange={(e) =>
              onChange({ ...fields, target_date: e.target.value || null })
            }
          />
        </div>
      </div>
      <div className="fg">
        <label className="fl">Связанные метрики</label>
        <div className="chip-row">
          {metrics.length === 0 ? (
            <span style={{ color: "var(--text-tertiary)" }}>
              Нет метрик. Создай их через «+ Создать».
            </span>
          ) : (
            metrics.map((m) => (
              <button
                key={m.id}
                type="button"
                className={`chip${
                  fields.linked_metric_ids.includes(m.id) ? " active" : ""
                }`}
                onClick={() => toggleMetric(m.id)}
              >
                {m.title}
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

// ---- Metric ---------------------------------------------------------

function MetricFieldsEditor({
  fields,
  onChange,
  entities,
}: {
  fields: MetricFields;
  onChange: (f: MetricFields) => void;
  entities: readonly Entity[];
}) {
  const goals = entities.filter((e) => e.type === "goal");
  return (
    <div className="type-specific">
      <div className="f-row">
        <div className="fg">
          <label className="fl">Единица</label>
          <input
            className="fi"
            value={fields.unit}
            onChange={(e) => onChange({ ...fields, unit: e.target.value })}
          />
        </div>
        <div className="fg">
          <label className="fl">Текущее значение</label>
          <input
            type="number"
            className="fi"
            style={{ fontFamily: "var(--mono)" }}
            value={fields.current_value}
            onChange={(e) =>
              onChange({
                ...fields,
                current_value: Number(e.target.value) || 0,
              })
            }
          />
        </div>
        <div className="fg">
          <label className="fl">Связанная цель</label>
          <select
            className="fi"
            value={fields.linked_goal_id ?? ""}
            onChange={(e) =>
              onChange({ ...fields, linked_goal_id: e.target.value || null })
            }
          >
            <option value="">— нет —</option>
            {goals.map((g) => (
              <option key={g.id} value={g.id}>
                {g.title}
              </option>
            ))}
          </select>
        </div>
      </div>
      <HistoryEditor
        history={fields.history}
        onChange={(history) => onChange({ ...fields, history })}
      />
    </div>
  );
}

// ---- Note -----------------------------------------------------------

function NoteFieldsEditor({
  fields,
  onChange,
}: {
  fields: NoteFields;
  onChange: (f: NoteFields) => void;
}) {
  return (
    <div className="type-specific">
      <div className="fg">
        <label className="fl">Содержимое (markdown)</label>
        <textarea
          className="fi"
          rows={12}
          style={{ fontFamily: "var(--mono)", minHeight: 240 }}
          value={fields.body}
          onChange={(e) => onChange({ ...fields, body: e.target.value })}
          placeholder={
            "# Заголовок\n## Подзаголовок\n- пункт\n- [ ] невыполненная задача\n- [x] выполненная\n**жирный** _курсив_\n---"
          }
        />
      </div>
    </div>
  );
}
