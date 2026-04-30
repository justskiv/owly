import { useEffect, useRef, useState } from "react";
import type { Area } from "../../schemas";
import { ProjectFieldsSchema } from "../../schemas/entity";
import { useEntityStore } from "../../store/entities";
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

  useEffect(() => {
    if (open) requestAnimationFrame(() => inputRef.current?.focus());
  }, [open]);

  const create = async () => {
    const title = text.trim();
    if (!title) return;
    try {
      const entity = await useEntityStore.getState().addEntity({
        type: "project",
        title,
        tags: [defaultCategory],
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
      toast.success(`✓ ${entity.title}`, { category: defaultCategory });
      setText("");
      // Stay open + focused so the user can chain creations (mirror
      // of TaskBar behaviour from Phase 3, spec §1.8).
      inputRef.current?.focus();
    } catch (e) {
      toast.error((e as Error).message);
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
        onKeyDown={(e) => {
          if (e.nativeEvent.isComposing) return;
          if (e.key === "Enter") {
            e.preventDefault();
            void create();
          } else if (e.key === "Escape") {
            e.preventDefault();
            setOpen(false);
            setText("");
          }
        }}
        onBlur={async () => {
          if (text.trim()) await create();
          setOpen(false);
          setText("");
        }}
        placeholder="Название проекта…"
        maxLength={200}
      />
    </div>
  );
}
