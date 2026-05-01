import { useEffect, useRef, useState } from "react";
import type { Area } from "../../schemas";
import { DirectionFieldsSchema } from "../../schemas/entity";
import { useEntityStore } from "../../store/entities";
import { toast } from "../shared/Toast";

interface Props {
  area: Area;
}

export function InlineCreateDirection({ area }: Props) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  // Locks create against Enter+blur racing. Same pattern as
  // projects/InlineAdd: clear text first, set the flag, await persist.
  const inFlightRef = useRef(false);
  // Distinguishes the post-Enter focus restore from a real user blur.
  // Without this, the synthetic blur from focus() would re-enter the
  // create path or commit a stale empty string.
  const justCreatedRef = useRef(false);
  // IME guard — blur during composition would commit a partial buffer.
  const composingRef = useRef(false);

  useEffect(() => {
    if (open) requestAnimationFrame(() => inputRef.current?.focus());
  }, [open]);

  const create = async (opts: { keepOpen: boolean }) => {
    if (inFlightRef.current) return;
    const title = text.trim();
    if (!title) return;
    inFlightRef.current = true;
    setText("");
    try {
      const ent = await useEntityStore.getState().addEntity({
        type: "direction",
        title,
        tags: [area.id],
        status: "active",
        priority: null,
        description: "",
        estimated_minutes: null,
        deadline: null,
        fields: DirectionFieldsSchema.parse({}),
      });
      toast.success(`✓ ${ent.title}`, { category: area.id });
      if (opts.keepOpen) {
        justCreatedRef.current = true;
        inputRef.current?.focus();
        // Clear the flag after the synchronous focus()-triggered blur
        // (if any) has been processed. Without this auto-clear the
        // ref stayed `true` until the user's next genuine blur, which
        // was then silently ignored — the next typed entry would not
        // commit on click-away.
        window.setTimeout(() => {
          justCreatedRef.current = false;
        }, 0);
      }
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      inFlightRef.current = false;
    }
  };

  if (!open) {
    return (
      <button
        type="button"
        className="add-trigger"
        style={{ marginTop: 6, maxWidth: 300 }}
        onClick={() => setOpen(true)}
      >
        <span className="at-plus">+</span> Направление
      </button>
    );
  }

  return (
    <div className="inline-add" style={{ maxWidth: 300, marginTop: 6 }}>
      <span className="ia-dot" style={{ background: area.color }} />
      <input
        ref={inputRef}
        type="text"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onCompositionStart={() => {
          composingRef.current = true;
        }}
        onCompositionEnd={() => {
          composingRef.current = false;
        }}
        onKeyDown={(e) => {
          if (e.nativeEvent.isComposing) return;
          if (e.key === "Enter") {
            e.preventDefault();
            void create({ keepOpen: true });
          } else if (e.key === "Escape") {
            e.preventDefault();
            setOpen(false);
            setText("");
          }
        }}
        onBlur={async () => {
          if (justCreatedRef.current) {
            justCreatedRef.current = false;
            return;
          }
          if (composingRef.current) {
            setOpen(false);
            setText("");
            return;
          }
          if (text.trim()) await create({ keepOpen: false });
          setOpen(false);
          setText("");
        }}
        placeholder="Название направления…"
        maxLength={200}
        style={{ paddingLeft: 2 }}
      />
    </div>
  );
}
