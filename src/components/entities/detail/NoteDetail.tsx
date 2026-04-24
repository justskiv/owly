import type { CSSProperties } from "react";
import type { NoteEntity } from "../../../schemas";
import { useConfigStore } from "../../../store/config";
import { countWords, parseNote } from "../../../services/note-parser";
import { getAreaColor } from "../../../services/categories";
import { fmtISODateTime } from "../../../services/format";
import { NoteBodyLines } from "./widgets/NoteBody";

interface NoteCSSProperties extends CSSProperties {
  "--note-accent"?: string;
}

export function NoteDetail({ entity }: { entity: NoteEntity }) {
  const areas = useConfigStore((s) => s.config?.areas) ?? [];
  const lines = parseNote(entity.fields.body);
  const words = countWords(entity.fields.body);
  const chars = entity.fields.body.length;
  const accentStyle: NoteCSSProperties | undefined =
    entity.tags.length > 0
      ? { "--note-accent": getAreaColor(entity.tags[0], areas) }
      : undefined;

  return (
    <section className="edp-sec">
      <div className="note-body" style={accentStyle}>
        {lines.length === 0 ? (
          <div className="n-p" style={{ color: "var(--text-disabled)" }}>
            Заметка пустая
          </div>
        ) : (
          <NoteBodyLines lines={lines} />
        )}
      </div>
      <div className="note-footer">
        <span className="note-updated">
          обновлено {fmtISODateTime(entity.updated_at)}
        </span>
        <span className="note-chars">
          {words} слов · {chars} символов
        </span>
      </div>
    </section>
  );
}
