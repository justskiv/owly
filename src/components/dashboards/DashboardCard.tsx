import type { DashboardEntry } from "../../schemas";
import { DashboardCardMenu } from "./DashboardCardMenu";
import { LucideIconByName } from "./LucideIconByName";

interface Props {
  entry: DashboardEntry;
  onOpen: () => void;
  onRename: () => void;
  onDelete: () => void;
}

const EMOJI_RE = /^\p{Extended_Pictographic}/u;

export function DashboardCard({ entry, onOpen, onRename, onDelete }: Props) {
  const isEmoji = EMOJI_RE.test(entry.icon);
  return (
    <article
      className="dcard"
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen();
        }
      }}
    >
      <div className="dcard-icon">
        {isEmoji ? entry.icon : <LucideIconByName name={entry.icon} />}
      </div>
      <div className="dcard-title">{entry.title}</div>
      {entry.description && (
        <div className="dcard-desc">{entry.description}</div>
      )}
      <DashboardCardMenu onRename={onRename} onDelete={onDelete} />
    </article>
  );
}
