import { addDays, parseIso, todayIso } from "../../../services/calendar-i18n";
import { formatRelativeRU } from "../../../services/date-format-ru";
import { MonthGrid } from "../../shared/MonthGrid";

interface DeadlinePickerProps {
  value: string | null;
  onChange: (iso: string | null) => void;
  onClose: () => void;
}

interface Preset {
  key: string;
  label: string;
  resolve: (today: string) => string | null;
}

const PRESETS: Preset[] = [
  { key: "today", label: "Сегодня", resolve: (t) => t },
  { key: "tomorrow", label: "Завтра", resolve: (t) => addDays(t, 1) },
  { key: "week", label: "+1 неделя", resolve: (t) => addDays(t, 7) },
];

export function DeadlinePicker({
  value,
  onChange,
  onClose,
}: DeadlinePickerProps) {
  const today = todayIso();

  const apply = (iso: string | null) => {
    onChange(iso);
    onClose();
  };

  const presetMatch = (p: Preset) => {
    if (!value) return false;
    return p.resolve(today) === value;
  };

  return (
    <div className="ep-dl-picker" role="group">
      <div className="ep-dl-presets">
        {PRESETS.map((p) => (
          <button
            key={p.key}
            type="button"
            className={`ep-dl-preset${presetMatch(p) ? " on" : ""}`}
            onClick={() => apply(p.resolve(today))}
          >
            {p.label}
          </button>
        ))}
      </div>
      <div className="ep-dl-cal">
        <MonthGrid
          value={value}
          todayIso={today}
          onChange={(iso) => apply(iso)}
          classPrefix="ep-dl"
        />
      </div>
    </div>
  );
}

export function formatDeadlinePill(iso: string): string {
  return formatRelativeRU(parseIso(iso), parseIso(todayIso()));
}
