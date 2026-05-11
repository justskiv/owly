import { describe, expect, it } from "vitest";
import { countWords, parseNote } from "./note-parser";

describe("parseNote — block kinds", () => {
  it("parses h1 and h2 headings", () => {
    expect(parseNote("# Big\n## Small")).toEqual([
      { kind: "h1", text: "Big" },
      { kind: "h2", text: "Small" },
    ]);
  });

  it("parses checkboxes — unchecked, checked-lowercase, checked-uppercase", () => {
    expect(parseNote("- [ ] todo\n- [x] done\n- [X] also done")).toEqual([
      { kind: "cb", done: false, text: "todo" },
      { kind: "cb", done: true, text: "done" },
      { kind: "cb", done: true, text: "also done" },
    ]);
  });

  it("parses list items (and prefers checkbox over plain list)", () => {
    const out = parseNote("- a\n- b\n- [ ] c");
    expect(out).toEqual([
      { kind: "li", text: "a" },
      { kind: "li", text: "b" },
      { kind: "cb", done: false, text: "c" },
    ]);
  });

  it("parses horizontal rule on 3+ dashes", () => {
    expect(parseNote("---\n----\n-----")).toEqual([
      { kind: "hr" },
      { kind: "hr" },
      { kind: "hr" },
    ]);
  });

  it("falls back to paragraph for unrecognised lines", () => {
    expect(parseNote("just text")).toEqual([
      { kind: "p", text: "just text" },
    ]);
  });

  it("drops blank lines (they only separate paragraphs)", () => {
    const out = parseNote("first\n\n\nsecond");
    expect(out).toEqual([
      { kind: "p", text: "first" },
      { kind: "p", text: "second" },
    ]);
  });
});

describe("parseNote — inline rendering", () => {
  it("wraps **bold** spans", () => {
    expect(parseNote("hello **world**")).toEqual([
      { kind: "p", text: 'hello <span class="n-b">world</span>' },
    ]);
  });

  it("wraps _italic_ spans at word boundaries", () => {
    expect(parseNote("an _italic_ bit")).toEqual([
      { kind: "p", text: 'an <span class="n-i">italic</span> bit' },
    ]);
  });

  it("does NOT italicise snake_case identifiers (no boundary)", () => {
    // foo_bar_baz must stay verbatim, otherwise log fragments and
    // ts/py identifiers in notes would render with broken spans.
    expect(parseNote("see foo_bar_baz here")).toEqual([
      { kind: "p", text: "see foo_bar_baz here" },
    ]);
  });

  it("escapes HTML before emitting our own spans", () => {
    // Bold/italic must wrap escaped content, not raw markup; otherwise
    // a note like `**<script>**` would render as live HTML.
    expect(parseNote("**<b>x</b>**")).toEqual([
      {
        kind: "p",
        text: '<span class="n-b">&lt;b&gt;x&lt;/b&gt;</span>',
      },
    ]);
  });

  it("escapes &, <, >, \", ' even outside inline markers", () => {
    expect(parseNote(`Tom & Jerry's <b>"hi"</b>`)).toEqual([
      {
        kind: "p",
        text: "Tom &amp; Jerry&#39;s &lt;b&gt;&quot;hi&quot;&lt;/b&gt;",
      },
    ]);
  });

  it("renders inline markup inside headings, lists, and checkboxes", () => {
    expect(
      parseNote("# h **bold**\n## h _it_\n- li _it_\n- [x] cb **b**"),
    ).toEqual([
      { kind: "h1", text: 'h <span class="n-b">bold</span>' },
      { kind: "h2", text: 'h <span class="n-i">it</span>' },
      { kind: "li", text: 'li <span class="n-i">it</span>' },
      { kind: "cb", done: true, text: 'cb <span class="n-b">b</span>' },
    ]);
  });
});

describe("countWords", () => {
  it("counts non-whitespace runs", () => {
    expect(countWords("one two three")).toBe(3);
  });

  it("collapses arbitrary whitespace (tabs, newlines, double spaces)", () => {
    expect(countWords("one\ttwo\n\nthree   four")).toBe(4);
  });

  it("returns 0 for empty / whitespace-only input", () => {
    expect(countWords("")).toBe(0);
    expect(countWords("   \n\t\n")).toBe(0);
  });
});
