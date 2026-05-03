interface Props {
  monthCount: number;
  currentMonthIdx: number;
  dropMonthIndex: number | null;
}

// Permanent drop row at the bottom of the table — useful when every
// project row is occupied or when the user wants to drop without
// scrolling to a particular project. Hit-testing happens in the drag
// hook (useHorizonDrag) via `closest('.month-cell[data-month]')`, so
// these cells need only carry the data attribute and the visual
// `drag-over` class.
export function HorizonDropRow({
  monthCount,
  currentMonthIdx,
  dropMonthIndex,
}: Props) {
  return (
    <tr className="hz-drop-row">
      <td className="name-cell">перетащи сюда ↓</td>
      {Array.from({ length: monthCount }, (_, i) => {
        let cls = "month-cell";
        if (i === currentMonthIdx) cls += " current";
        if (dropMonthIndex === i) cls += " drag-over";
        return <td key={i} className={cls} data-month={i} />;
      })}
    </tr>
  );
}
