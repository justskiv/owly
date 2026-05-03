import type { HorizonSize } from "../../schemas";
import { useHorizonStore } from "../../store/horizon";

interface Props {
  group: HorizonSize;
  label: string;
  icon: string;
  count: number;
  collapsed: boolean;
  colspan: number;
}

export function HorizonGroupHeader({
  group,
  label,
  icon,
  count,
  collapsed,
  colspan,
}: Props) {
  const toggle = () => {
    void useHorizonStore.getState().toggleGroup(group);
  };
  return (
    <tr className="hz-group-row" onClick={toggle}>
      <td colSpan={colspan}>
        <div className="hz-group-head">
          <span>{collapsed ? "▶" : "▼"}</span>
          <span>{icon}</span>
          <span>{label}</span>
          <span className="hg-cnt">{count}</span>
        </div>
      </td>
    </tr>
  );
}
