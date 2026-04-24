const DAYS_RU = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];

interface Props {
  weekDone: boolean[]; // 7 entries, Mon..Sun
  today: number; // 0..6 index of today within Mon..Sun, or -1 if today is outside the shown week
}

export function StreakWeek({ weekDone, today }: Props) {
  return (
    <div className="streak-week">
      {DAYS_RU.map((d, i) => {
        const cls = [
          weekDone[i] ? "done" : "",
          i === today ? "today" : "",
        ]
          .filter(Boolean)
          .join(" ");
        return (
          <div
            key={i}
            className={`streak-day${cls ? ` ${cls}` : ""}`}
          >
            {d}
          </div>
        );
      })}
    </div>
  );
}
