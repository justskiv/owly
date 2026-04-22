import { BarChart3, Calendar, Database, Settings } from "lucide-react";
import type { ComponentType } from "react";
import { useUIStore, type Page } from "../../store/ui";
import { clickableProps } from "../shared/makeClickable";

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
    <nav className="sidebar">
      <div className="s-logo">OS</div>
      <div className="s-top">
        {NAV.map(({ id, icon: Icon, label }) => {
          const active = currentPage === id;
          return (
            <div
              key={id}
              className={`si${active ? " active" : ""}`}
              title={label}
              {...clickableProps(() => setPage(id))}
            >
              <Icon size={18} strokeWidth={1.5} />
            </div>
          );
        })}
      </div>
      <div className="s-bot">
        <div
          className="si"
          title="Настройки (скоро)"
          aria-disabled="true"
          tabIndex={-1}
          style={{ cursor: "default" }}
        >
          <Settings size={18} strokeWidth={1.5} />
        </div>
      </div>
    </nav>
  );
}
