// Tiny line-based markdown subset for note bodies. Supported syntax:
//
//   # heading 1
//   ## heading 2
//   - [ ] unchecked checkbox
//   - [x] checked checkbox
//   - list item
//   --- (3+ dashes) horizontal rule
//   **bold** and _italic_ inline
//
// Everything else is a paragraph. All text is HTML-escaped before
// inline replacements, so renderers can safely use
// dangerouslySetInnerHTML on the returned strings.

export type NoteLine =
  | { kind: "h1"; text: string }
  | { kind: "h2"; text: string }
  | { kind: "p"; text: string }
  | { kind: "li"; text: string }
  | { kind: "cb"; text: string; done: boolean }
  | { kind: "hr" };

const HR_RE = /^-{3,}$/;
const CB_RE = /^- \[( |x|X)\] (.*)$/;
const LI_RE = /^- (.*)$/;
const H2_RE = /^## (.*)$/;
const H1_RE = /^# (.*)$/;

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function renderInline(s: string): string {
  // Must escape before we emit our own spans.
  let out = escapeHtml(s);
  // Bold first so `_italic_` inside **bold** still works.
  out = out.replace(/\*\*([^*]+)\*\*/g, '<span class="n-b">$1</span>');
  out = out.replace(/_([^_]+)_/g, '<span class="n-i">$1</span>');
  return out;
}

export function parseNote(body: string): NoteLine[] {
  const lines = body.split(/\r?\n/);
  const out: NoteLine[] = [];
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue; // blank lines just separate paragraphs
    if (HR_RE.test(line)) {
      out.push({ kind: "hr" });
      continue;
    }
    const cb = CB_RE.exec(line);
    if (cb) {
      out.push({
        kind: "cb",
        done: cb[1].toLowerCase() === "x",
        text: renderInline(cb[2]),
      });
      continue;
    }
    const li = LI_RE.exec(line);
    if (li) {
      out.push({ kind: "li", text: renderInline(li[1]) });
      continue;
    }
    const h2 = H2_RE.exec(line);
    if (h2) {
      out.push({ kind: "h2", text: renderInline(h2[1]) });
      continue;
    }
    const h1 = H1_RE.exec(line);
    if (h1) {
      out.push({ kind: "h1", text: renderInline(h1[1]) });
      continue;
    }
    out.push({ kind: "p", text: renderInline(line) });
  }
  return out;
}

export function countWords(body: string): number {
  const m = body.match(/\S+/g);
  return m ? m.length : 0;
}
