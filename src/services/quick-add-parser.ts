import { formatDate, getStartOfDay } from "./time-utils";

export interface ParsedQuickAdd {
  title: string;
  deadline: string | null;
}

// Inline modifiers parsed from the Quick Add input. Order matters:
// послезавтра is tested before завтра because the latter is a suffix
// substring of the former. Using `(?=\s|$)` instead of `\b` because
// JS `\b` is ASCII-only and behaves unintuitively next to Cyrillic.
const ISO_DATE = /!(\d{4}-\d{2}-\d{2})(?=\s|$)/;
const MM_DD = /!(\d{2})\.(\d{2})(?=\s|$)/;
const POSLEZAVTRA = /!послезавтра(?=\s|$)/;
const ZAVTRA = /!завтра(?=\s|$)/;

export function parseQuickAdd(input: string, baseDate?: Date): ParsedQuickAdd {
  const base = getStartOfDay(baseDate);

  let deadline: string | null = null;
  let matched: string | null = null;

  const isoMatch = input.match(ISO_DATE);
  if (isoMatch) {
    deadline = isoMatch[1];
    matched = isoMatch[0];
  }

  if (!matched) {
    const m = input.match(MM_DD);
    if (m) {
      deadline = `${base.getFullYear()}-${m[1]}-${m[2]}`;
      matched = m[0];
    }
  }

  if (!matched) {
    const m = input.match(POSLEZAVTRA);
    if (m) {
      const d = new Date(base);
      d.setDate(d.getDate() + 2);
      deadline = formatDate(d);
      matched = m[0];
    }
  }

  if (!matched) {
    const m = input.match(ZAVTRA);
    if (m) {
      const d = new Date(base);
      d.setDate(d.getDate() + 1);
      deadline = formatDate(d);
      matched = m[0];
    }
  }

  let title = matched ? input.replace(matched, "") : input;
  title = title.replace(/\s+/g, " ").trim();

  return { title, deadline };
}
