import { formatDateRU, DAYS_RU_SHORT_LIST } from "./date-format-ru";
import { getStartOfDay } from "./time-utils";

export interface PopoverItem {
  key: string;
  label: string;
  secondary: string;
  apply: string;
  isAction?: "open-picker";
}

function addDays(base: Date, days: number): Date {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return d;
}

function buildAll(baseDate: Date): PopoverItem[] {
  const items: PopoverItem[] = [
    {
      key: "tomorrow",
      label: "завтра",
      secondary: formatDateRU(addDays(baseDate, 1)),
      apply: "!завтра",
    },
    {
      key: "day-after",
      label: "послезавтра",
      secondary: formatDateRU(addDays(baseDate, 2)),
      apply: "!послезавтра",
    },
    {
      key: "next-week",
      label: "через неделю",
      secondary: formatDateRU(addDays(baseDate, 7)),
      apply: "!через неделю",
    },
    {
      key: "next-month",
      label: "через месяц",
      secondary: formatDateRU(addDays(baseDate, 30)),
      apply: "!через месяц",
    },
  ];
  for (let n = 1; n <= 5; n++) {
    const d = addDays(baseDate, n);
    const dow = DAYS_RU_SHORT_LIST[d.getDay()];
    items.push({
      key: `dow-${n}`,
      label: dow,
      secondary: formatDateRU(d),
      apply: `!${dow}`,
    });
  }
  items.push({
    key: "pick",
    label: "Выбрать дату…",
    secondary: "",
    apply: "",
    isAction: "open-picker",
  });
  return items;
}

export function buildPopoverItems(
  filter: string,
  baseDate: Date = getStartOfDay(),
): PopoverItem[] {
  const all = buildAll(baseDate);
  const f = filter.trim().toLowerCase();
  if (!f) return all;
  return all.filter((it) => {
    const lbl = it.label.toLowerCase();
    return lbl.startsWith(f) || lbl.includes(f);
  });
}
