import type { ReactNode } from "react";
import type { DayOfWeek, SchedulingPreferences } from "../../schemas";
import { useConfigStore } from "../../store/config";
import { KvTable } from "./KvTable";

const MEETING_OPTIONS: { value: string; label: string }[] = [
  { value: "weekdays", label: "В будни" },
  { value: "weekends", label: "В выходные" },
  { value: "any", label: "Любой день" },
];

const DAY_OPTIONS: { value: DayOfWeek; label: string }[] = [
  { value: "mon", label: "Понедельник" },
  { value: "sun", label: "Воскресенье" },
];

export function SchedulingTab() {
  const config = useConfigStore((s) => s.config);
  const setPrefs = useConfigStore((s) => s.setSchedulingPrefs);
  if (!config) return null;
  const p = config.scheduling_preferences;

  const update = (patch: Partial<SchedulingPreferences>) => {
    void setPrefs({ ...p, ...patch });
  };

  return (
    <div className="settings-inner sched-form">
      <div className="settings-hint">
        Эти настройки агент читает при планировании. Изменения
        применяются для следующих команд.
      </div>

      <Section title="Часы для глубокой работы">
        <Range
          start={p.deep_work_hours.start}
          end={p.deep_work_hours.end}
          onChange={(start, end) =>
            update({ deep_work_hours: { start, end } })
          }
        />
      </Section>

      <Section title="Не звонить раньше">
        <input
          type="time"
          className="fi sched-time"
          value={p.no_calls_before}
          onChange={(e) => update({ no_calls_before: e.target.value })}
        />
      </Section>

      <Section
        title="Минимальная длительность блока"
        hint="по типу работы, в минутах"
      >
        <KvTable
          value={p.min_block_duration}
          onChange={(min_block_duration) => update({ min_block_duration })}
          keyLabel="Тип"
          valueLabel="Минут"
          defaultValue={30}
        />
      </Section>

      <Section title="Буфер после события" hint="в минутах">
        <KvTable
          value={p.buffer_after}
          onChange={(buffer_after) => update({ buffer_after })}
          keyLabel="После чего"
          valueLabel="Минут"
          defaultValue={15}
        />
      </Section>

      <Section title="Часы для хобби">
        <Range
          start={p.hobby_hours.start}
          end={p.hobby_hours.end}
          onChange={(start, end) => update({ hobby_hours: { start, end } })}
        />
      </Section>

      <Section title="Подряд занятых вечеров — макс." hint="0–7">
        <input
          type="number"
          className="fi sched-num"
          min={0}
          max={7}
          value={p.max_consecutive_busy_evenings}
          onChange={(e) =>
            update({
              max_consecutive_busy_evenings:
                parseInt(e.target.value, 10) || 0,
            })
          }
        />
      </Section>

      <Section title="Когда ставить встречи">
        <select
          className="fi sched-select"
          value={p.meeting_preference}
          onChange={(e) => update({ meeting_preference: e.target.value })}
        >
          {MEETING_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </Section>

      <Section title="Учитывать дорогу в длительности встречи">
        <label className="sched-check">
          <input
            type="checkbox"
            checked={p.include_travel_time}
            onChange={(e) =>
              update({ include_travel_time: e.target.checked })
            }
          />
          <span>Включать travel_time сущностей в расчёт блоков</span>
        </label>
      </Section>

      <Section title="Начало недели">
        <select
          className="fi sched-select"
          value={p.week_starts_on}
          onChange={(e) =>
            update({ week_starts_on: e.target.value as DayOfWeek })
          }
        >
          {DAY_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </Section>
    </div>
  );
}

interface SectionProps {
  title: string;
  hint?: string;
  children: ReactNode;
}

function Section({ title, hint, children }: SectionProps) {
  return (
    <div className="sched-section">
      <div className="sched-label">
        {title}
        {hint && <span className="sched-hint"> · {hint}</span>}
      </div>
      <div className="sched-control">{children}</div>
    </div>
  );
}

interface RangeProps {
  start: string;
  end: string;
  onChange: (start: string, end: string) => void;
}

function Range({ start, end, onChange }: RangeProps) {
  return (
    <div className="sched-range">
      <input
        type="time"
        className="fi sched-time"
        value={start}
        onChange={(e) => onChange(e.target.value, end)}
      />
      <span className="sched-range-sep">—</span>
      <input
        type="time"
        className="fi sched-time"
        value={end}
        onChange={(e) => onChange(start, e.target.value)}
      />
    </div>
  );
}
