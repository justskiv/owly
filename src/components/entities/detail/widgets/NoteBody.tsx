import type { NoteLine } from "../../../../services/note-parser";

export function NoteBodyLines({ lines }: { lines: NoteLine[] }) {
  return (
    <>
      {lines.map((line, i) => (
        <NoteLineRenderer key={i} line={line} />
      ))}
    </>
  );
}

// Each line is rendered via dangerouslySetInnerHTML because the parser
// already escaped raw user text and only injects `<span class="n-b|n-i">`
// tags. Rendering inline via React nodes would require a second parser
// pass — the current approach keeps the parser contract (safe HTML
// strings) honest.
function NoteLineRenderer({ line }: { line: NoteLine }) {
  switch (line.kind) {
    case "h1":
      return (
        <div className="n-h1" dangerouslySetInnerHTML={{ __html: line.text }} />
      );
    case "h2":
      return (
        <div className="n-h2" dangerouslySetInnerHTML={{ __html: line.text }} />
      );
    case "p":
      return (
        <div className="n-p" dangerouslySetInnerHTML={{ __html: line.text }} />
      );
    case "li":
      return (
        <div className="n-li">
          <span className="n-bullet">●</span>
          <span dangerouslySetInnerHTML={{ __html: line.text }} />
        </div>
      );
    case "cb":
      return (
        <div className="n-li">
          <span className={`n-cb${line.done ? " checked" : ""}`} />
          <span
            className={`n-cb-text${line.done ? " done" : ""}`}
            dangerouslySetInnerHTML={{ __html: line.text }}
          />
        </div>
      );
    case "hr":
      return <div className="n-hr" />;
  }
}
