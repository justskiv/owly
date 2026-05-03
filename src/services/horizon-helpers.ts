import type { HorizonProjectState } from "../schemas";

// Russian month abbreviations, capitalised. Used both as table-header
// labels and in BacklogItem month dots.
export const MONTHS_RU_SHORT = [
  "Янв", "Фев", "Мар", "Апр", "Май", "Июн",
  "Июл", "Авг", "Сен", "Окт", "Ноя", "Дек",
] as const;

export interface HorizonMonth {
  label: string;
  isCurrent: boolean;
}

// Returns 8 months starting at baseMonth (always the first day).
// `i` is the offset from baseMonth (0..7), NOT the month-of-year —
// state.months store these relative offsets, not absolute indices.
// Auto-shift of baseMonth as the wall-clock advances is deferred to
// Phase 9.
export function getHorizonMonths(baseMonth: string): HorizonMonth[] {
  const [y, m] = baseMonth.split("-").map(Number);
  return Array.from({ length: 8 }, (_, i) => {
    const d = new Date(y, m - 1 + i, 1);
    return {
      label: MONTHS_RU_SHORT[d.getMonth()],
      isCurrent: i === 0,
    };
  });
}

export type BacklogSectionKind = "active" | "someday" | "deferred";

// Section assignment is purely derived from months[] and hidden — see
// spec §8.3. `hzPrio` from the mock is dead state and not implemented.
export function classifyProject(s: HorizonProjectState): BacklogSectionKind {
  if (s.hidden) return "deferred";
  if (s.months.length > 0) return "active";
  return "someday";
}

// state.months entries are offsets from baseMonth (D9), not absolute
// month-of-year indices. This shifts an offset through baseMonth so a
// stored `[0, 1]` with baseMonth `2026-05-01` renders as `"Май Июн"`.
export function offsetToMonthLabel(baseMonth: string, offset: number): string {
  const [y, m] = baseMonth.split("-").map(Number);
  const d = new Date(y, m - 1 + offset, 1);
  return MONTHS_RU_SHORT[d.getMonth()];
}

export const SIZE_GROUPS = [
  { id: "big", label: "Тяжёлые проекты", icon: "⏨" },
  { id: "mid", label: "Средние проекты", icon: "□" },
  { id: "small", label: "Мелкие проекты", icon: "○" },
] as const;

export const SECTION_META: Record<
  BacklogSectionKind,
  { icon: string; label: string }
> = {
  active: { icon: "●", label: "Актуальное" },
  someday: { icon: "○", label: "Когда-нибудь" },
  deferred: { icon: "⏸", label: "Скрытое" },
};
