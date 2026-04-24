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
