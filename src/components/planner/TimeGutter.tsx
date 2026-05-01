import {
  END_HOUR,
  START_HOUR,
  minutesToTime,
} from "../../services/time-utils";

const ROW_COUNT = (END_HOUR - START_HOUR) * 2;

export function TimeGutter() {
  return (
    <div className="time-gutter">
      <div className="day-head-spacer" />
      {Array.from({ length: ROW_COUNT }, (_, i) => {
        const minutes = START_HOUR * 60 + i * 30;
        const isHour = minutes % 60 === 0;
        return (
          <div key={i} className="time-row">
            {isHour ? minutesToTime(minutes) : ""}
          </div>
        );
      })}
    </div>
  );
}
