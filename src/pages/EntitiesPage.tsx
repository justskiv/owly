import { useEntityStore } from "../store/entities";

export function EntitiesPage() {
  const entities = useEntityStore((s) => s.entities);
  return (
    <div className="p-6 text-slate-300">
      <p className="text-lg">Сущности.</p>
      <p className="mt-2 text-sm text-slate-400">
        Всего: <span className="text-slate-200">{entities.length}</span>
      </p>
    </div>
  );
}
