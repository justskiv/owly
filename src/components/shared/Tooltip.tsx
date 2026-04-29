import {
  cloneElement,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactElement,
  type ReactNode,
} from "react";

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
  const id = useId();
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

  // Clear any pending open-timer if the component unmounts mid-hover
  // (e.g. user closes the window while a tooltip is about to appear).
  useEffect(
    () => () => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    },
    [],
  );

  // Wire aria-describedby on the trigger so screen readers announce the
  // tooltip content alongside the trigger's own aria-label.
  const child = cloneElement(
    children as ReactElement<{ "aria-describedby"?: string }>,
    {
      "aria-describedby": open ? id : undefined,
    },
  );

  return (
    <span
      className="tooltip-wrap"
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
      onFocus={handleEnter}
      onBlur={handleLeave}
    >
      {child}
      {open && (
        <span
          id={id}
          className={`tooltip tooltip-${placement}`}
          role="tooltip"
        >
          {content}
        </span>
      )}
    </span>
  );
}
