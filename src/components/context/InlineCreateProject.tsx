import { useEffect, useRef, useState } from "react";
import type { Area, DirectionEntity } from "../../schemas";
import { ProjectFieldsSchema } from "../../schemas/entity";
import { useEntityStore } from "../../store/entities";
import { pickAreaTag } from "../../services/categories";
import { FALLBACK_BOARD_ID } from "../../services/boards";
import { toast } from "../shared/Toast";

interface Props {
  direction: DirectionEntity;
  areas: readonly Area[];
  open: boolean;
  onClose: () => void;
}

// Single-shot inline create — unlike the per-column projects InlineAdd,
// the direction-card variant closes after creating one project. The
// user wanted "+ Проект" to be a momentary input, not a chained entry
// point inside an already-busy card layout.
export function InlineCreateProject({ direction, areas, open, onClose }: Props) {
  const [text, setText] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const inFlightRef = useRef(false);
  const composingRef = useRef(false);

  useEffect(() => {
    if (open) requestAnimationFrame(() => inputRef.current?.focus());
  }, [open]);

  const create = async () => {
    if (inFlightRef.current) return;
    const title = text.trim();
    if (!title) return;
    inFlightRef.current = true;
    setText("");
    // Inherit the direction's area tag, falling back to "work" if the
    // direction has none — ProjectFieldsSchema requires a category.
    const cat = pickAreaTag(direction.tags, areas) ?? "work";
    try {
      const ent = await useEntityStore.getState().addEntity({
        type: "project",
        title,
        tags: [cat],
        status: "active",
        priority: null,
        description: "",
        estimated_minutes: null,
        deadline: null,
        fields: ProjectFieldsSchema.parse({
          board_id: FALLBACK_BOARD_ID,
          column_index: 0,
          direction_id: direction.id,
        }),
      });
      toast.success(`✓ ${ent.title} → ${direction.title}`, { category: cat });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      inFlightRef.current = false;
      onClose();
    }
  };

  if (!open) return null;

  // marginTop:auto puts the input at the bottom of the flex column
  // (replacing dc-actions, which has the same auto-margin). margin
  // overrides the .inline-add base style of `margin: 4px 0`.
  return (
    <div className="inline-add" style={{ margin: "auto 0 0", flexShrink: 0 }}>
      <input
        ref={inputRef}
        type="text"
        value={text}
        style={{ paddingLeft: 2, minWidth: 0 }}
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
            void create();
          } else if (e.key === "Escape") {
            e.preventDefault();
            setText("");
            onClose();
          }
        }}
        onBlur={async () => {
          if (composingRef.current) {
            setText("");
            onClose();
            return;
          }
          if (text.trim()) {
            await create();
          } else {
            onClose();
          }
        }}
        placeholder={`Проект для «${direction.title}»…`}
        maxLength={200}
      />
    </div>
  );
}
