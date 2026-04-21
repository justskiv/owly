import { useScheduleStore } from "../store/schedule";

export function PlannerPage() {
  const blocks = useScheduleStore((s) => s.blocks);
  const week = useScheduleStore((s) => s.currentWeek);
  return (
    <div className="p-6 text-slate-300">
      <p className="text-lg">Планировщик будет здесь.</p>
      <p className="mt-2 text-sm text-slate-400">
        Текущая неделя: <span className="text-slate-200">{week}</span>. Блоков:{" "}
        <span className="text-slate-200">{blocks.length}</span>
      </p>
    </div>
  );
}
