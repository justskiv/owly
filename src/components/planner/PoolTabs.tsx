import { useUIStore, type SideTab } from "../../store/ui";

const TABS: Array<{ id: SideTab; label: string }> = [
  { id: "pool", label: "Пул" },
  { id: "tasks", label: "Задачи" },
  { id: "projects", label: "Проекты" },
  { id: "dirs", label: "Контекст" },
];

export function PoolTabs() {
  const sideTab = useUIStore((s) => s.sideTab);
  const setSideTab = useUIStore((s) => s.setSideTab);
  return (
    <div className="pool-tabs" role="tablist">
      {TABS.map((t) => (
        <button
          key={t.id}
          type="button"
          role="tab"
          aria-selected={sideTab === t.id}
          className={"pt-tab" + (sideTab === t.id ? " active" : "")}
          onClick={() => setSideTab(t.id)}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}
