export const CATEGORIES = [
  "work",
  "people",
  "life",
  "growth",
  "health",
] as const;

export type Category = (typeof CATEGORIES)[number];

const KNOWN = new Set<string>(CATEGORIES);

// CSS variables defined in globals.css :root. Inline-style lookups
// avoid hard-coding hex values in TSX.
export const CAT_COLORS: Record<Category, string> = {
  work: "var(--work)",
  people: "var(--people)",
  life: "var(--life)",
  growth: "var(--growth)",
  health: "var(--health)",
};

// First tag that matches a known category wins. Falls back to "work"
// so ghost/block CSS classes always resolve to a styled rule.
export function pickCategory(tags: readonly string[]): Category {
  for (const t of tags) {
    if (KNOWN.has(t)) return t as Category;
  }
  return "work";
}

// Area is a dynamic concept — the user can add custom ones in Settings.
// These helpers resolve a tag string against the runtime config rather
// than the five built-ins, so custom areas render correctly.
export function getAreaColor(
  tag: string,
  areas: readonly { id: string; color: string }[],
): string {
  const a = areas.find((x) => x.id === tag);
  return a?.color ?? "#707070";
}

export function getAreaLabel(
  tag: string,
  areas: readonly { id: string; label: string }[],
): string {
  const a = areas.find((x) => x.id === tag);
  return a?.label ?? tag;
}

// First tag from the entity that resolves to a configured area. Returns
// null when no tag matches — non-area tags (legacy / future free tags)
// are ignored. Callers fall back to a neutral grey dot.
export function pickAreaTag(
  tags: readonly string[],
  areas: readonly { id: string }[],
): string | null {
  const ids = new Set(areas.map((a) => a.id));
  for (const t of tags) {
    if (ids.has(t)) return t;
  }
  return null;
}
