import type {
  ContactFields,
  DayOfWeek,
  Entity,
  EntityType,
  EventFields,
  GoalFields,
  MetricFields,
  NoteFields,
  PipelineStage,
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
  // Fields is a union across all entity types; the caller uses the
  // correct shape per `type`. We cast inside each branch.
  fields: Entity["fields"];
  onChange: (fields: Entity["fields"]) => void;
  entities: readonly Entity[];
  pipelineStages: readonly string[];
}

export function TypeSpecificFields(props: Props) {
  switch (props.type) {
    case "task":
      return <TaskFieldsEditor {...props} />;
    case "project":
      return <ProjectFieldsEditor {...props} />;
    case "routine":
      return <RoutineFieldsEditor {...props} />;
    case "event":
      return <EventFieldsEditor {...props} />;
    case "contact":
      return <ContactFieldsEditor {...props} />;
    case "goal":
      return <GoalFieldsEditor {...props} />;
    case "metric":
      return <MetricFieldsEditor {...props} />;
    case "note":
      return <NoteFieldsEditor {...props} />;
  }
}

// ---- Task -----------------------------------------------------------

function TaskFieldsEditor({ fields, onChange, entities }: Props) {
  const f = fields as TaskFields;
  const projects = entities.filter((e) => e.type === "project");
  return (
    <div className="type-specific">
      <div className="fg">
        <label className="fl">Родительский проект</label>
        <select
          className="fi"
          value={f.parent_project_id ?? ""}
          onChange={(e) =>
            onChange({
              ...f,
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
        items={f.checklist}
        onChange={(checklist) => onChange({ ...f, checklist })}
      />
    </div>
  );
}

// ---- Project --------------------------------------------------------

function ProjectFieldsEditor({ fields, onChange, pipelineStages }: Props) {
  const f = fields as ProjectFields;
  return (
    <div className="type-specific">
      <div className="fg">
        <label className="fl">Описание</label>
        <textarea
          className="fi"
          rows={3}
          value={f.description}
          onChange={(e) => onChange({ ...f, description: e.target.value })}
        />
      </div>
      <div className="fg">
        <label className="fl">Стадия пайплайна</label>
        <select
          className="fi"
          value={f.pipeline_stage}
          onChange={(e) =>
            onChange({
              ...f,
              pipeline_stage: e.target.value as PipelineStage,
            })
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

function RoutineFieldsEditor({ fields, onChange }: Props) {
  const f = fields as RoutineFields;
  const toggleDay = (d: DayOfWeek) => {
    const next = f.days.includes(d)
      ? f.days.filter((x) => x !== d)
      : [...f.days, d];
    onChange({ ...f, days: next });
  };
  return (
    <div className="type-specific">
      <div className="fg">
        <label className="fl">Частота</label>
        <select
          className="fi"
          value={f.frequency}
          onChange={(e) =>
            onChange({ ...f, frequency: e.target.value as RoutineFrequency })
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
              className={`chip${f.days.includes(d) ? " active" : ""}`}
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
            value={f.default_duration}
            onChange={(e) =>
              onChange({
                ...f,
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
            value={f.default_time}
            onChange={(e) => onChange({ ...f, default_time: e.target.value })}
          />
        </div>
      </div>
    </div>
  );
}

// ---- Event ----------------------------------------------------------

function EventFieldsEditor({ fields, onChange }: Props) {
  const f = fields as EventFields;
  return (
    <div className="type-specific">
      <div className="f-row">
        <div className="fg">
          <label className="fl">Дата</label>
          <input
            type="date"
            className="fi"
            value={f.date}
            onChange={(e) => onChange({ ...f, date: e.target.value })}
          />
        </div>
        <div className="fg">
          <label className="fl">Время</label>
          <input
            className="fi"
            style={{ fontFamily: "var(--mono)" }}
            value={f.time}
            onChange={(e) => onChange({ ...f, time: e.target.value })}
          />
        </div>
        <div className="fg">
          <label className="fl">Длит. (мин)</label>
          <input
            type="number"
            className="fi"
            style={{ fontFamily: "var(--mono)" }}
            value={f.duration}
            onChange={(e) =>
              onChange({
                ...f,
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
          value={f.location}
          onChange={(e) => onChange({ ...f, location: e.target.value })}
        />
      </div>
      <div className="fg">
        <label className="fl">Дорога (мин, в одну сторону)</label>
        <input
          type="number"
          className="fi"
          style={{ fontFamily: "var(--mono)" }}
          value={f.travel_time}
          onChange={(e) =>
            onChange({
              ...f,
              travel_time: Math.max(0, Number(e.target.value) || 0),
            })
          }
        />
      </div>
    </div>
  );
}

// ---- Contact --------------------------------------------------------

function ContactFieldsEditor({ fields, onChange }: Props) {
  const f = fields as ContactFields;
  return (
    <div className="type-specific">
      <div className="fg">
        <label className="fl">Имя</label>
        <input
          className="fi"
          value={f.name}
          onChange={(e) => onChange({ ...f, name: e.target.value })}
        />
      </div>
      <div className="f-row">
        <div className="fg">
          <label className="fl">Частота (дни)</label>
          <input
            type="number"
            className="fi"
            style={{ fontFamily: "var(--mono)" }}
            value={f.desired_cadence_days ?? ""}
            onChange={(e) =>
              onChange({
                ...f,
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
            value={f.last_contact ?? ""}
            onChange={(e) =>
              onChange({
                ...f,
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
            value={f.travel_time}
            onChange={(e) =>
              onChange({
                ...f,
                travel_time: Math.max(0, Number(e.target.value) || 0),
              })
            }
          />
        </div>
      </div>
      <TopicsEditor
        topics={f.topics}
        onChange={(topics) => onChange({ ...f, topics })}
      />
      <ImportantDatesEditor
        dates={f.important_dates}
        onChange={(important_dates) => onChange({ ...f, important_dates })}
      />
      <div className="fg">
        <label className="fl">Заметки</label>
        <textarea
          className="fi"
          rows={3}
          value={f.notes}
          onChange={(e) => onChange({ ...f, notes: e.target.value })}
        />
      </div>
    </div>
  );
}

// ---- Goal -----------------------------------------------------------

function GoalFieldsEditor({ fields, onChange, entities }: Props) {
  const f = fields as GoalFields;
  const metrics = entities.filter((e) => e.type === "metric");
  const toggleMetric = (id: string) => {
    const next = f.linked_metric_ids.includes(id)
      ? f.linked_metric_ids.filter((x) => x !== id)
      : [...f.linked_metric_ids, id];
    onChange({ ...f, linked_metric_ids: next });
  };
  return (
    <div className="type-specific">
      <div className="f-row">
        <div className="fg">
          <label className="fl">Цель (значение)</label>
          <input
            className="fi"
            value={f.target}
            onChange={(e) => onChange({ ...f, target: e.target.value })}
          />
        </div>
        <div className="fg">
          <label className="fl">Текущее</label>
          <input
            className="fi"
            value={f.current_value}
            onChange={(e) =>
              onChange({ ...f, current_value: e.target.value })
            }
          />
        </div>
        <div className="fg">
          <label className="fl">Дедлайн</label>
          <input
            type="date"
            className="fi"
            value={f.target_date ?? ""}
            onChange={(e) =>
              onChange({ ...f, target_date: e.target.value || null })
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
                className={`chip${f.linked_metric_ids.includes(m.id) ? " active" : ""}`}
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

function MetricFieldsEditor({ fields, onChange, entities }: Props) {
  const f = fields as MetricFields;
  const goals = entities.filter((e) => e.type === "goal");
  return (
    <div className="type-specific">
      <div className="f-row">
        <div className="fg">
          <label className="fl">Единица</label>
          <input
            className="fi"
            value={f.unit}
            onChange={(e) => onChange({ ...f, unit: e.target.value })}
          />
        </div>
        <div className="fg">
          <label className="fl">Текущее значение</label>
          <input
            type="number"
            className="fi"
            style={{ fontFamily: "var(--mono)" }}
            value={f.current_value}
            onChange={(e) =>
              onChange({
                ...f,
                current_value: Number(e.target.value) || 0,
              })
            }
          />
        </div>
        <div className="fg">
          <label className="fl">Связанная цель</label>
          <select
            className="fi"
            value={f.linked_goal_id ?? ""}
            onChange={(e) =>
              onChange({ ...f, linked_goal_id: e.target.value || null })
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
        history={f.history}
        onChange={(history) => onChange({ ...f, history })}
      />
    </div>
  );
}

// ---- Note -----------------------------------------------------------

function NoteFieldsEditor({ fields, onChange }: Props) {
  const f = fields as NoteFields;
  return (
    <div className="type-specific">
      <div className="fg">
        <label className="fl">Содержимое (markdown)</label>
        <textarea
          className="fi"
          rows={12}
          style={{ fontFamily: "var(--mono)", minHeight: 240 }}
          value={f.body}
          onChange={(e) => onChange({ ...f, body: e.target.value })}
          placeholder={"# Заголовок\n## Подзаголовок\n- пункт\n- [ ] невыполненная задача\n- [x] выполненная\n**жирный** _курсив_\n---"}
        />
      </div>
    </div>
  );
}
