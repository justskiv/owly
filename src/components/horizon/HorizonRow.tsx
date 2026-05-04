import { useCallback, useState, type MouseEvent } from "react";
import { EyeOff, X } from "lucide-react";
import type {
  Area,
  HorizonProjectState,
  HorizonSize,
  ProjectEntity,
} from "../../schemas";
import { getAreaColor, pickAreaTag } from "../../services/categories";
import { useHorizonStore } from "../../store/horizon";
import { toast } from "../shared/Toast";
import { HorizonSizeMenu } from "./HorizonSizeMenu";

interface Props {
  state: HorizonProjectState;
  project: ProjectEntity;
  monthCount: number;
  currentMonthIdx: number;
  areas: readonly Area[];
  highlighted: boolean;
  dropMonthIndex: number | null;
}

const FALLBACK_COLOR = "var(--text-tertiary)";

export function HorizonRow({
  state,
  project,
  monthCount,
  currentMonthIdx,
  areas,
  highlighted,
  dropMonthIndex,
}: Props) {
  const areaTag = pickAreaTag(project.tags, areas);
  const color = areaTag ? getAreaColor(areaTag, areas) : FALLBACK_COLOR;
  const [sizeMenuOpen, setSizeMenuOpen] = useState(false);
  // Stable ref so HorizonSizeMenu's effect doesn't rebind document
  // listeners on every parent render while the menu is open.
  const closeSizeMenu = useCallback(() => setSizeMenuOpen(false), []);

  const onContextMenu = (e: MouseEvent) => {
    e.preventDefault();
    setSizeMenuOpen(true);
  };

  const onSelectSize = (size: HorizonSize) => {
    void useHorizonStore
      .getState()
      .setSize(project.id, size)
      .catch((err: unknown) => {
        toast.error(`Не удалось: ${(err as Error).message}`);
      });
    setSizeMenuOpen(false);
  };

  const toggleChip = (mIdx: number) => {
    const cur = state.months;
    const next = cur.includes(mIdx)
      ? cur.filter((m) => m !== mIdx)
      : [...cur, mIdx].sort((a, b) => a - b);
    void useHorizonStore
      .getState()
      .setMonths(project.id, next)
      .catch((e: unknown) => {
        toast.error(`Не удалось: ${(e as Error).message}`);
      });
  };

  const onHide = (e: MouseEvent) => {
    e.stopPropagation();
    void useHorizonStore
      .getState()
      .setHidden(project.id, true)
      .catch((err: unknown) => {
        toast.error(`Не удалось: ${(err as Error).message}`);
      });
  };

  // Spec §8.2: × clears months but does NOT delete the project entity.
  // Hidden state intentionally untouched — stale hidden+empty stays in
  // "Скрытое", a fresh delete on a visible project moves it to
  // "Когда-нибудь" via classifyProject.
  const onClear = (e: MouseEvent) => {
    e.stopPropagation();
    void useHorizonStore
      .getState()
      .setMonths(project.id, [])
      .catch((err: unknown) => {
        toast.error(`Не удалось: ${(err as Error).message}`);
      });
  };

  return (
    <tr className={highlighted ? "highlighted" : ""}>
      <td className="name-cell">
        <div className="hz-name" onContextMenu={onContextMenu}>
          <span className="hz-dot" style={{ background: color }} />
          <span>{project.title}</span>
          {sizeMenuOpen && (
            <HorizonSizeMenu
              active={state.size}
              onSelect={onSelectSize}
              onClose={closeSizeMenu}
            />
          )}
          <div className="hz-actions">
            <button
              type="button"
              className="hz-action-btn"
              onClick={onHide}
              title="Скрыть"
              aria-label="Скрыть"
            >
              <EyeOff size={12} strokeWidth={2} />
            </button>
            <button
              type="button"
              className="hz-action-btn danger"
              onClick={onClear}
              title="Снять с доски"
              aria-label="Снять с доски"
            >
              <X size={12} strokeWidth={2} />
            </button>
          </div>
        </div>
      </td>
      {Array.from({ length: monthCount }, (_, i) => {
        let cls = "month-cell";
        if (i === currentMonthIdx) cls += " current";
        if (dropMonthIndex === i) cls += " drag-over";
        const has = state.months.includes(i);
        return (
          <td
            key={i}
            className={cls}
            data-month={i}
            onClick={() => toggleChip(i)}
          >
            {has && (
              <span
                className="hz-chip"
                style={{ background: `${color}33`, color }}
              >
                ●
              </span>
            )}
          </td>
        );
      })}
    </tr>
  );
}
