import { useRef, useState, type ReactElement, type ReactNode } from "react";

interface TooltipProps {
  content: ReactNode;
  children: ReactElement;
  delay?: number;
  placement?: "below" | "above";
}

export function Tooltip({
  content,
  children,
  delay = 600,
  placement = "below",
}: TooltipProps) {
  const [open, setOpen] = useState(false);
  const timerRef = useRef<number | null>(null);

  const handleEnter = () => {
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => setOpen(true), delay);
  };
  const handleLeave = () => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setOpen(false);
  };

  return (
    <span
      className="tooltip-wrap"
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
      onFocus={handleEnter}
      onBlur={handleLeave}
    >
      {children}
      {open && (
        <span className={`tooltip tooltip-${placement}`} role="tooltip">
          {content}
        </span>
      )}
    </span>
  );
}
