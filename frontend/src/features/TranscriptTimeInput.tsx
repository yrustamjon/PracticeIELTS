import { useEffect, useState } from "react";

const seconds = (ms: number) => (Number.isFinite(ms) ? String(ms / 1000) : "");

export function TranscriptTimeInput({
  milliseconds,
  label,
  disabled,
  invalid,
  duration,
  onCommit,
}: {
  milliseconds: number;
  label: string;
  disabled: boolean;
  invalid: boolean;
  duration?: number;
  onCommit: (milliseconds: number) => void;
}) {
  const [draft, setDraft] = useState(seconds(milliseconds));
  useEffect(() => setDraft(seconds(milliseconds)), [milliseconds]);
  return (
    <input
      aria-label={label}
      aria-invalid={invalid}
      type="number"
      disabled={disabled}
      min="0"
      step=".001"
      max={duration === undefined ? undefined : duration / 1000}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => {
        const value = draft.trim() ? Math.round(Number(draft) * 1000) : NaN;
        if (!Object.is(value, milliseconds)) onCommit(value);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          e.currentTarget.blur();
        }
      }}
    />
  );
}
