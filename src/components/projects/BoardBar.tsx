import type { Area } from "../../schemas";
import { useUIStore } from "../../store/ui";
import { BOARDS, type BoardId } from "../../services/boards";

export function BoardBar({ areas }: { areas: readonly Area[] }) {
  const activeBoard = useUIStore((s) => s.activeBoard);
  const setActiveBoard = useUIStore((s) => s.setActiveBoard);
  const catFilter = useUIStore((s) => s.catFilter);
  const staleFilter = useUIStore((s) => s.staleFilter);
  const setCatFilter = useUIStore((s) => s.setCatFilter);

  return (
    <div className="board-bar">
      <div className="board-tabs">
        {BOARDS.map((b) => (
          <button
            key={b.id}
            type="button"
            className={`board-tab${activeBoard === b.id ? " active" : ""}`}
            onClick={() => setActiveBoard(b.id as BoardId)}
          >
            {b.title}
          </button>
        ))}
      </div>
      <div className="cat-filters">
        <button
          type="button"
          className={`cat-btn all-btn${
            !catFilter && !staleFilter ? " active" : ""
          }`}
          onClick={() => setCatFilter(null)}
        >
          Все
        </button>
        {areas.map((a) => (
          <button
            key={a.id}
            type="button"
            className={`cat-btn${catFilter === a.id ? " active" : ""}`}
            style={{ background: a.color }}
            onClick={() => setCatFilter(catFilter === a.id ? null : a.id)}
            aria-label={a.label}
            aria-pressed={catFilter === a.id}
            title={a.label}
          />
        ))}
      </div>
    </div>
  );
}
