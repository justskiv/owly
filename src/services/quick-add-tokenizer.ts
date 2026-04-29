import { formatDate, getStartOfDay } from "./time-utils";
import { formatRelativeRU, DAYS_RU_SHORT_LIST } from "./date-format-ru";

export type TokenType =
  | "text"
  | "date-modifier"
  | "date-modifier-invalid"
  | "date-modifier-past";

export interface Token {
  type: TokenType;
  start: number;
  end: number;
  raw: string;
  deadline?: string;
  humanLabel?: string;
}

export interface ParsedQuickAdd {
  title: string;
  deadline: string | null;
}

// Order matters: longer alternatives must come first because JS regex
// alternation picks the first match in source order, not the longest.
// "послезавтра" before "завтра" (latter is a suffix of the former).
// "tomorrow" before "tmrw"/"tom".
const MODIFIER_REGEX =
  /!(?:\d{4}-\d{2}-\d{2}|\d{2}\.\d{2}|послезавтра|завтра|пн|вт|ср|чт|пт|сб|вс|tomorrow|tmrw|tom|через\s+неделю|через\s+месяц)/g;

export function tokenize(input: string, baseDate?: Date): Token[] {
  if (input === "") return [];
  const base = getStartOfDay(baseDate);
  const tokens: Token[] = [];
  let cursor = 0;

  for (const m of input.matchAll(MODIFIER_REGEX)) {
    const start = m.index;
    if (start === undefined) continue;
    const end = start + m[0].length;

    // Whitespace boundary: ! must follow start-of-input or whitespace,
    // and the modifier must end at end-of-input or whitespace. Skip the
    // match otherwise (it stays as part of a text token).
    const charBefore = start > 0 ? input[start - 1] : "";
    const charAfter = end < input.length ? input[end] : "";
    const leftOk = start === 0 || /\s/.test(charBefore);
    const rightOk = end === input.length || /\s/.test(charAfter);
    if (!leftOk || !rightOk) continue;

    if (start > cursor) {
      tokens.push({
        type: "text",
        start: cursor,
        end: start,
        raw: input.slice(cursor, start),
      });
    }

    const resolved = resolveModifier(m[0], base);
    tokens.push({ ...resolved, start, end, raw: m[0] });
    cursor = end;
  }

  if (cursor < input.length) {
    tokens.push({
      type: "text",
      start: cursor,
      end: input.length,
      raw: input.slice(cursor),
    });
  }

  return tokens;
}

interface ResolvedModifier {
  type: TokenType;
  deadline?: string;
  humanLabel?: string;
}

function resolveModifier(raw: string, base: Date): ResolvedModifier {
  const rest = raw.slice(1);

  const isoMatch = rest.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) {
    return resolveExplicitDate(
      parseInt(isoMatch[1], 10),
      parseInt(isoMatch[2], 10),
      parseInt(isoMatch[3], 10),
      base,
    );
  }

  // DD.MM — Russian locale convention: day first, then month.
  // "!13.10" → 13 октября; "!13.40" → invalid (40 is not a month).
  const ddmmMatch = rest.match(/^(\d{2})\.(\d{2})$/);
  if (ddmmMatch) {
    return resolveExplicitDate(
      base.getFullYear(),
      parseInt(ddmmMatch[2], 10),
      parseInt(ddmmMatch[1], 10),
      base,
    );
  }

  if (rest === "послезавтра") return resolveRelative(2, base);
  if (
    rest === "завтра" ||
    rest === "tomorrow" ||
    rest === "tmrw" ||
    rest === "tom"
  ) {
    return resolveRelative(1, base);
  }
  if (/^через\s+неделю$/.test(rest)) return resolveRelative(7, base);
  if (/^через\s+месяц$/.test(rest)) return resolveRelative(30, base);

  const dowIndex = DAYS_RU_SHORT_LIST.indexOf(rest);
  if (dowIndex !== -1) {
    const baseDow = base.getDay();
    // "Closest such day in the future". If today matches, jump to next
    // week (+7) — Things 3 / Reminders behavior. Never resolves to today.
    const diff = ((dowIndex - baseDow + 7) % 7) || 7;
    return resolveRelative(diff, base);
  }

  return { type: "date-modifier-invalid" };
}

function resolveExplicitDate(
  year: number,
  month: number,
  day: number,
  base: Date,
): ResolvedModifier {
  // Validate via Date roundtrip — JS rolls over invalid combos
  // (Feb 30 → Mar 2), so a mismatch on getFullYear/getMonth/getDate
  // means the input wasn't a real calendar date.
  const d = new Date(year, month - 1, day);
  if (
    d.getFullYear() !== year ||
    d.getMonth() !== month - 1 ||
    d.getDate() !== day
  ) {
    return { type: "date-modifier-invalid" };
  }
  d.setHours(0, 0, 0, 0);
  const deadline = formatDate(d);
  const humanLabel = formatRelativeRU(d, base);
  if (d.getTime() < base.getTime()) {
    return { type: "date-modifier-past", deadline, humanLabel };
  }
  return { type: "date-modifier", deadline, humanLabel };
}

function resolveRelative(days: number, base: Date): ResolvedModifier {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  const deadline = formatDate(d);
  const humanLabel = formatRelativeRU(d, base);
  return { type: "date-modifier", deadline, humanLabel };
}

// True when 2+ active (recognized AND not deactivated) date-modifier
// or date-modifier-past tokens coexist in the input. Invalid tokens
// are NOT counted — they are parse-errors with their own UI signal,
// not a conflict between competing dates.
export function isConflict(
  tokens: Token[],
  deactivatedSpans: Set<string>,
): boolean {
  let activeDates = 0;
  for (const t of tokens) {
    if (t.type !== "date-modifier" && t.type !== "date-modifier-past") continue;
    const span = `${t.start}-${t.end}`;
    if (deactivatedSpans.has(span)) continue;
    activeDates++;
    if (activeDates > 1) return true;
  }
  return false;
}

export function tokensToParsed(
  tokens: Token[],
  deactivatedSpans: Set<string>,
): ParsedQuickAdd {
  let activeDeadline: string | null = null;
  for (let i = tokens.length - 1; i >= 0; i--) {
    const t = tokens[i];
    if (t.type === "date-modifier" || t.type === "date-modifier-past") {
      const span = `${t.start}-${t.end}`;
      if (!deactivatedSpans.has(span)) {
        activeDeadline = t.deadline ?? null;
        break;
      }
    }
  }

  let title = "";
  for (const t of tokens) {
    if (t.type === "text") {
      title += t.raw;
      continue;
    }
    // Any recognized modifier (valid / past / invalid) is cut unless
    // the user explicitly deactivated it via click. Visually it is
    // already highlighted as "not part of title", so cutting matches
    // expectations. Click-to-deactivate is the escape hatch when the
    // user wanted a literal "!13.40" or similar in the title.
    const span = `${t.start}-${t.end}`;
    if (deactivatedSpans.has(span)) {
      title += t.raw;
    }
  }
  title = title.replace(/\s+/g, " ").trim();

  return { title, deadline: activeDeadline };
}
