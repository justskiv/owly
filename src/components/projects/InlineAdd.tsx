import { useEffect, useRef, useState } from "react";
import type { Area } from "../../schemas";
import { ProjectFieldsSchema } from "../../schemas/entity";
import { useEntityStore } from "../../store/entities";
import { useUIStore } from "../../store/ui";
import { getAreaColor } from "../../services/categories";
import { toast } from "../shared/Toast";

interface Props {
  boardId: string;
  columnIndex: number;
  defaultCategory: string;
  areas: readonly Area[];
}

export function InlineAdd({
  boardId,
  columnIndex,
  defaultCategory,
  areas,
}: Props) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  // Locks the create path so a fast Enter→blur doesn't fire two
  // addEntity calls for the same draft. Without this, Enter starts an
  // async write, blur sees the same `text` (cleared only after await),
  // and creates the same project a second time.
  const inFlightRef = useRef(false);
  // Distinguishes "blur fired because we just refocused after Enter"
  // (no-op) from "blur fired because the user clicked elsewhere"
  // (commit + close). Without this the post-Enter focus restore would
  // race the user's actual blur and we either steal focus or commit
  // an empty draft.
  const justCreatedRef = useRef(false);
  // IME composition flag — blur during composition would commit a
  // mid-composition title.
  const composingRef = useRef(false);

  useEffect(() => {
    if (open) requestAnimationFrame(() => inputRef.current?.focus());
  }, [open]);

  const create = async (opts: { keepOpen: boolean }) => {
    if (inFlightRef.current) return;
    const title = text.trim();
    if (!title) return;
    inFlightRef.current = true;
    // Clear the draft FIRST so any racing handler (blur after Enter,
    // double-Enter, etc.) sees an empty input and bails out.
    setText("");
    // Inherit the active category filter when one is selected — adding
    // a project to a filtered board with the wrong tag would make it
    // vanish from the user's current view. Read non-reactively so the
    // component doesn't subscribe to filter changes mid-typing.
    const activeCat = useUIStore.getState().catFilter;
    const category =
      activeCat && areas.some((a) => a.id === activeCat)
        ? activeCat
        : defaultCategory;
    try {
      const entity = await useEntityStore.getState().addEntity({
        type: "project",
        title,
        tags: [category],
        status: "active",
        priority: null,
        description: "",
        estimated_minutes: null,
        deadline: null,
        fields: ProjectFieldsSchema.parse({
          board_id: boardId,
          column_index: columnIndex,
        }),
      });
      toast.success(`✓ ${entity.title}`, { category });
      if (opts.keepOpen) {
        justCreatedRef.current = true;
        inputRef.current?.focus();
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
        className="ia-trigger"
        onClick={() => setOpen(true)}
      >
        + Проект
      </button>
    );
  }

  const dotColor = getAreaColor(defaultCategory, areas);

  return (
    <div className="inline-add">
      <span className="ia-dot" style={{ background: dotColor }} />
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
            // Don't commit a partial IME buffer; close instead.
            setOpen(false);
            setText("");
            return;
          }
          if (text.trim()) await create({ keepOpen: false });
          setOpen(false);
          setText("");
        }}
        placeholder="Название проекта…"
        maxLength={200}
      />
    </div>
  );
}
