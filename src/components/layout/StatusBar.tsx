import { useEntityStore } from "../../store/entities";
import { useUIStore, type SaveStatus } from "../../store/ui";
import { pluralRu } from "../../services/format";

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

const DOT_COLOR: Record<SaveStatus, string> = {
  idle: "var(--success)",
  saved: "var(--success)",
  saving: "var(--accent)",
  error: "var(--error)",
};

export function StatusBar() {
  const count = useEntityStore((s) => s.entities.length);
  const status = useUIStore((s) => s.saveStatus);
  const savedAt = useUIStore((s) => s.savedAt);

  const label =
    status === "saving"
      ? "Сохранение…"
      : status === "error"
        ? "Ошибка сохранения"
        : savedAt
          ? `Сохранено ${pad2(savedAt.getHours())}:${pad2(savedAt.getMinutes())}`
          : "Сохранено";

  return (
    <div className="sbar">
      <span className="dot" style={{ background: DOT_COLOR[status] }} />
      <span role="status" aria-live="polite" aria-label="Статус сохранения">
        {label}
      </span>
      <span className="sep" />
      {count} {pluralRu(count, "сущность", "сущности", "сущностей")}
      <div className="hints">
        <span>
          <kbd>1</kbd>
          <kbd>2</kbd>
          <kbd>3</kbd> страницы
        </span>
        <span>
          <kbd>N</kbd> блок
        </span>
      </div>
    </div>
  );
}
