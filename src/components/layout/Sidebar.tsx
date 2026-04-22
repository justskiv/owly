import { BarChart3, Calendar, Database, Settings } from "lucide-react";
import type { ComponentType } from "react";
import { useUIStore, type Page } from "../../store/ui";

interface NavItem {
  id: Page;
  icon: ComponentType<{ size?: number; strokeWidth?: number }>;
  label: string;
}

const NAV: NavItem[] = [
  { id: "planner", icon: Calendar, label: "Планировщик" },
  { id: "entities", icon: Database, label: "Данные" },
  { id: "dashboards", icon: BarChart3, label: "Дашборды" },
];

export function Sidebar() {
  const currentPage = useUIStore((s) => s.currentPage);
  const setPage = useUIStore((s) => s.setPage);

  return (
    <nav className="sidebar" aria-label="Главная навигация">
      <div className="s-logo">OS</div>
      <div className="s-top">
        {NAV.map(({ id, icon: Icon, label }) => {
          const active = currentPage === id;
          return (
            <button
              key={id}
              type="button"
              className={`si${active ? " active" : ""}`}
              aria-label={label}
              aria-current={active ? "page" : undefined}
              title={label}
              onClick={() => setPage(id)}
            >
              <Icon size={18} strokeWidth={1.5} />
            </button>
          );
        })}
      </div>
      <div className="s-bot">
        <button
          type="button"
          className="si"
          title="Настройки (скоро)"
          aria-label="Настройки"
          disabled
        >
          <Settings size={18} strokeWidth={1.5} />
        </button>
      </div>
    </nav>
  );
}
