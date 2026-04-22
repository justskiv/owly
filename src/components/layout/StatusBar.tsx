import { useEntityStore } from "../../store/entities";
import { pluralRu } from "../../services/format";

export function StatusBar() {
  const count = useEntityStore((s) => s.entities.length);
  return (
    <div className="sbar">
      <span className="dot" />
      Сохранено
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
        <span>
          <kbd>T</kbd> пул
        </span>
        <span>drag блоки и пул</span>
      </div>
    </div>
  );
}
