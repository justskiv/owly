import { useEffect, useState } from "react";
import type { Entity } from "../../../../schemas";
import { useEntityStore } from "../../../../store/entities";
import { useUIStore } from "../../../../store/ui";
import { toast } from "../../../shared/Toast";

export function DetailActions({ entity }: { entity: Entity }) {
  const openEdit = useUIStore((s) => s.openEntityEditorEdit);
  const setSelected = useUIStore((s) => s.setSelectedEntity);
  const [confirming, setConfirming] = useState(false);

  // Two-click delete: the first click flips the button into a red
  // confirm state with 3s to confirm, matching the planner's
  // in-app confirmation pattern rather than a browser alert.
  useEffect(() => {
    if (!confirming) return;
    const t = window.setTimeout(() => setConfirming(false), 3000);
    return () => window.clearTimeout(t);
  }, [confirming]);

  const handleDelete = async () => {
    if (!confirming) {
      setConfirming(true);
      return;
    }
    const title = entity.title;
    try {
      await useEntityStore.getState().deleteEntity(entity.id);
      setSelected(null);
      toast.success(`✕ Удалён: ${title}`);
    } catch (e) {
      toast.error(`Не удалось удалить: ${(e as Error).message}`);
    }
  };

  return (
    <div className="edp-actions">
      <button
        type="button"
        className="edp-btn edp-btn-p"
        onClick={() => openEdit(entity.id)}
      >
        Редактировать
      </button>
      <button
        type="button"
        className={`edp-btn edp-btn-d${confirming ? " confirm" : ""}`}
        onClick={handleDelete}
      >
        {confirming ? "Точно удалить?" : "Удалить"}
      </button>
    </div>
  );
}
