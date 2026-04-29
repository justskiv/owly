import {
  forwardRef,
  useRef,
  type KeyboardEvent,
  type UIEvent,
} from "react";
import type { Token } from "../../services/quick-add-tokenizer";

interface QuickAddInputProps {
  value: string;
  onChange: (v: string) => void;
  onKeyDown: (e: KeyboardEvent<HTMLInputElement>) => void;
  tokens: Token[];
  deactivatedSpans: string[];
  conflict: boolean;
  onTokenClick: (span: string) => void;
  placeholder?: string;
}

function tokenClass(
  token: Token,
  deactivated: boolean,
  conflict: boolean,
): string {
  if (token.type === "text") return "";
  if (deactivated) return "qa-token-highlight deactivated";
  if (token.type === "date-modifier-invalid")
    return "qa-token-highlight invalid";
  if (
    conflict &&
    (token.type === "date-modifier" || token.type === "date-modifier-past")
  ) {
    return "qa-token-highlight conflict";
  }
  if (token.type === "date-modifier-past") return "qa-token-highlight past";
  return "qa-token-highlight";
}

export const QuickAddInput = forwardRef<HTMLInputElement, QuickAddInputProps>(
  function QuickAddInput(
    {
      value,
      onChange,
      onKeyDown,
      tokens,
      deactivatedSpans,
      conflict,
      onTokenClick,
      placeholder,
    },
    ref,
  ) {
    const overlayRef = useRef<HTMLDivElement>(null);

    // Keep the overlay's horizontal scroll synced with the input so token
    // highlights stay aligned with the actual text once content exceeds
    // the visible width.
    const handleScroll = (e: UIEvent<HTMLInputElement>) => {
      if (overlayRef.current) {
        overlayRef.current.scrollLeft = e.currentTarget.scrollLeft;
      }
    };

    return (
      <div className="qa-input-wrap">
        <div ref={overlayRef} className="qa-input-overlay" aria-hidden="true">
          {tokens.length === 0 ? (
            <span>{value}</span>
          ) : (
            tokens.map((t) => {
              const span = `${t.start}-${t.end}`;
              const cls = tokenClass(
                t,
                deactivatedSpans.includes(span),
                conflict,
              );
              if (cls === "") return <span key={span}>{t.raw}</span>;
              return (
                <span
                  key={span}
                  className={cls}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onTokenClick(span);
                  }}
                >
                  {t.raw}
                </span>
              );
            })
          )}
        </div>
        <input
          ref={ref}
          type="text"
          className="qa-input"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={onKeyDown}
          onScroll={handleScroll}
          placeholder={placeholder}
          maxLength={200}
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
        />
      </div>
    );
  },
);
