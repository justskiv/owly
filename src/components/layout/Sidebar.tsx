import { BarChart3, Calendar, Database, Settings } from "lucide-react";
import type { ComponentType } from "react";
import { useUIStore, type Page } from "../../store/ui";

const NAV: { id: Page; icon: ComponentType<{ size?: number }>; label: string }[] =
  [
    { id: "planner", icon: Calendar, label: "Планировщик" },
    { id: "entities", icon: Database, label: "Данные" },
    { id: "dashboards", icon: BarChart3, label: "Дашборды" },
  ];

const STATUS_DOT: Record<string, string> = {
  idle: "bg-slate-700",
  saving: "bg-blue-400",
  saved: "bg-green-400",
  error: "bg-red-500",
};

export function Sidebar() {
  const currentPage = useUIStore((s) => s.currentPage);
  const setPage = useUIStore((s) => s.setPage);
  const saveStatus = useUIStore((s) => s.saveStatus);
  const saveError = useUIStore((s) => s.saveError);

  return (
    <nav className="flex w-[60px] flex-col items-center justify-between bg-slate-950 py-4">
      <div className="flex flex-col gap-2">
        {NAV.map(({ id, icon: Icon, label }) => {
          const active = currentPage === id;
          return (
            <button
              key={id}
              type="button"
              title={label}
              onClick={() => setPage(id)}
              className={`flex h-10 w-10 items-center justify-center rounded-lg transition ${
                active
                  ? "bg-slate-800 text-white"
                  : "text-slate-400 hover:bg-slate-900 hover:text-slate-200"
              }`}
            >
              <Icon size={20} />
            </button>
          );
        })}
      </div>

      <div className="flex flex-col items-center gap-3">
        <div
          className={`h-2 w-2 rounded-full ${STATUS_DOT[saveStatus]}`}
          title={
            saveStatus === "error" && saveError
              ? `Ошибка: ${saveError}`
              : `Статус: ${saveStatus}`
          }
        />
        <button
          type="button"
          disabled
          title="Настройки (скоро)"
          className="flex h-10 w-10 cursor-not-allowed items-center justify-center rounded-lg text-slate-600"
        >
          <Settings size={20} />
        </button>
      </div>
    </nav>
  );
}
