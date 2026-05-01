import { WEEKDAYS_RU } from "../../services/time-utils";

interface Props {
  date: string;
  dayIdx: number;
  isToday: boolean;
}

export function DayHeader({ date, dayIdx, isToday }: Props) {
  const dayNum = parseInt(date.slice(8, 10), 10);
  return (
    <div
      className={"day-head" + (isToday ? " today" : "")}
      data-tauri-drag-region
    >
      {WEEKDAYS_RU[dayIdx]} {dayNum}
    </div>
  );
}
