import type { MouseEvent } from "react";
import type { ProjectEntity } from "../../schemas";
import { freshClass, tooltipText } from "../../services/context-helpers";
import { InlineProjectEditor } from "./InlineProjectEditor";

interface Props {
  project: ProjectEntity;
  isOpen: boolean;
  onToggle: () => void;
  onUnlink: () => void;
}

function ClockIcon() {
  return (
    <svg
      width="10"
      height="10"
      viewBox="0 0 16 16"
      fill="none"
      style={{ opacity: 0.6 }}
      aria-hidden
    >
      <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.3" />
      <path
        d="M8 5v3.5l2.5 1.5"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
      />
    </svg>
  );
}

function BrokenLinkIcon() {
  return (
    <svg
      width="11"
      height="11"
      viewBox="0 0 11 11"
      fill="none"
      aria-hidden
    >
      <path
        d="M4 7L7 4M3 5.5L1.8 6.7a1.5 1.5 0 0 0 2.1 2.1L5.5 7M5.5 4L6.7 2.8a1.5 1.5 0 0 1 2.1 2.1L7 6.5"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
      <path
        d="M1.5 1.5l8 8"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        opacity=".5"
      />
    </svg>
  );
}

export function DirectionProjectRow({
  project,
  isOpen,
  onToggle,
  onUnlink,
}: Props) {
  const la = project.fields.last_activity_days;
  const handleUnlink = (e: MouseEvent) => {
    // Stop the click from bubbling up to the row's onClick (which
    // toggles the inline editor) — without this, clicking unlink
    // would also open or close the editor on every row.
    e.stopPropagation();
    onUnlink();
  };
  return (
    <>
      <div className="dc-proj" onClick={onToggle}>
        <span>{project.title}</span>
        <span
          className={`dc-days ${freshClass(la)}`}
          data-tooltip={tooltipText(la)}
        >
          <ClockIcon />
          {la}д
        </span>
        <button
          type="button"
          className="dc-unlink"
          onClick={handleUnlink}
          aria-label="Отвязать"
          data-tooltip="Отвязать"
        >
          <BrokenLinkIcon />
        </button>
      </div>
      {isOpen && <InlineProjectEditor project={project} />}
    </>
  );
}
