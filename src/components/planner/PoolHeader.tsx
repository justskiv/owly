import { useUIStore } from "../../store/ui";
import { getWeekNumber } from "../../services/time-utils";

interface Props {
  weekId: string;
}

export function PoolHeader({ weekId }: Props) {
  const sideTab = useUIStore((s) => s.sideTab);
  const openPoolModal = useUIStore((s) => s.openPoolModal);
  const wn = getWeekNumber(weekId);
  return (
    <div className="pool-header">
      <h3>ПУЛ · W{wn}</h3>
      <button
        type="button"
        className="pool-add-btn"
        onClick={() =>
          openPoolModal(sideTab === "tasks" ? "new-task" : "new-pool-item")
        }
        aria-label="Добавить"
        title="Добавить"
      >
        +
      </button>
    </div>
  );
}
