import type { LucideIcon } from "lucide-react";
import type { HorizonSize } from "../../schemas";
import { useHorizonStore } from "../../store/horizon";

interface Props {
  group: HorizonSize;
  label: string;
  Icon: LucideIcon;
  count: number;
  collapsed: boolean;
  colspan: number;
}

export function HorizonGroupHeader({
  group,
  label,
  Icon,
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
          <Icon size={14} strokeWidth={1.6} aria-hidden="true" />
          <span>{label}</span>
          <span className="hg-cnt">{count}</span>
        </div>
      </td>
    </tr>
  );
}
