import type { ArchiveGroup as Group } from "../../services/archive-grouping";
import { ArchiveRow } from "./ArchiveRow";

export function ArchiveGroup({ group }: { group: Group }) {
  return (
    <section className="arch-group">
      <h2 className="arch-group-head">{group.label}</h2>
      {group.items.map((t) => (
        <ArchiveRow task={t} key={t.id} />
      ))}
    </section>
  );
}
