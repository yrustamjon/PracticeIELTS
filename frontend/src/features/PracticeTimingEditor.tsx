import { useId, useState } from "react";
import { Minus, Plus, SlidersHorizontal } from "lucide-react";
import { ErrorState } from "../components/ui";
import "./practiceTiming.css";

export type PlaybackTiming = { start_ms: number; end_ms: number };

function milliseconds(value: string): number | undefined {
  if (!/^(?:\d+(?:\.\d{0,3})?|\.\d{1,3})$/.test(value.trim())) return;
  const number = Math.round(Number(value) * 1000);
  return Number.isSafeInteger(number) ? number : undefined;
}

export function PracticeTimingEditor({
  interval,
  duration,
  previousEnd,
  nextStart,
  busy,
  onPreview,
  onSave,
}: {
  interval: PlaybackTiming;
  duration: number;
  previousEnd?: number;
  nextStart?: number;
  busy: boolean;
  onPreview: (timing: PlaybackTiming | null) => void;
  onSave: (start: number, end: number) => Promise<void>;
}) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [start, setStart] = useState((interval.start_ms / 1000).toFixed(3));
  const [end, setEnd] = useState((interval.end_ms / 1000).toFixed(3));
  const [error, setError] = useState<unknown>();
  const startMs = milliseconds(start);
  const endMs = milliseconds(end);
  const boundsError =
    startMs === undefined || endMs === undefined
      ? "Enter seconds with up to three decimal places."
      : endMs <= startMs
        ? "End time must be later than start time."
        : endMs > duration
          ? `The recording ends at ${(duration / 1000).toFixed(3)} seconds.`
          : "";
  const overlapError =
    startMs !== undefined && previousEnd !== undefined && startMs < previousEnd
      ? `Start overlaps the previous exercise, which ends at ${(previousEnd / 1000).toFixed(3)}s. Adjust that exercise first.`
      : endMs !== undefined && nextStart !== undefined && endMs > nextStart
        ? `End overlaps the next exercise, which starts at ${(nextStart / 1000).toFixed(3)}s. Adjust that exercise first.`
        : "";
  const changed = startMs !== interval.start_ms || endMs !== interval.end_ms;

  function cancel() {
    setStart((interval.start_ms / 1000).toFixed(3));
    setEnd((interval.end_ms / 1000).toFixed(3));
    setError(undefined);
    setOpen(false);
    onPreview(null);
  }
  function nudge(field: "start" | "end", change: number) {
    const current = field === "start" ? startMs : endMs;
    if (current === undefined) return;
    const value = (
      Math.min(duration, Math.max(0, current + change)) / 1000
    ).toFixed(3);
    (field === "start" ? setStart : setEnd)(value);
    setError(undefined);
  }
  async function save() {
    if (
      boundsError ||
      overlapError ||
      startMs === undefined ||
      endMs === undefined
    )
      return;
    setError(undefined);
    try {
      await onSave(startMs, endMs);
    } catch (failure) {
      setError(failure);
    }
  }

  return (
    <div className="practice-timing-editor">
      <button
        type="button"
        className="text-link practice-timing-toggle"
        aria-expanded={open}
        aria-controls={`${id}-controls`}
        disabled={busy}
        onClick={() => (open ? cancel() : setOpen(true))}
      >
        <SlidersHorizontal size={15} /> Adjust timing
      </button>
      {open && (
        <form
          id={`${id}-controls`}
          className="practice-timing-controls"
          onSubmit={(event) => {
            event.preventDefault();
            void save();
          }}
          aria-label="Edit exercise timing"
        >
          <p>
            Adjust this exercise in the original audio. Saved timing applies to
            new Easy attempts.
          </p>
          <div className="practice-timing-fields">
            {(["start", "end"] as const).map((field) => (
              <div className="practice-timing-field" key={field}>
                <label htmlFor={`${id}-${field}`}>
                  {field === "start" ? "Start" : "End"} time (seconds)
                </label>
                <div>
                  <button
                    type="button"
                    className="icon-button"
                    disabled={busy}
                    aria-label={`${field === "start" ? "Start" : "End"} earlier by 0.1 seconds`}
                    onClick={() => nudge(field, -100)}
                  >
                    <Minus size={15} />
                  </button>
                  <input
                    id={`${id}-${field}`}
                    type="text"
                    inputMode="decimal"
                    autoComplete="off"
                    spellCheck={false}
                    value={field === "start" ? start : end}
                    disabled={busy}
                    onChange={(event) => {
                      (field === "start" ? setStart : setEnd)(
                        event.target.value,
                      );
                      setError(undefined);
                    }}
                    aria-describedby={`${id}-feedback`}
                  />
                  <button
                    type="button"
                    className="icon-button"
                    disabled={busy}
                    aria-label={`${field === "start" ? "Start" : "End"} later by 0.1 seconds`}
                    onClick={() => nudge(field, 100)}
                  >
                    <Plus size={15} />
                  </button>
                </div>
              </div>
            ))}
          </div>
          <p
            id={`${id}-feedback`}
            className={
              boundsError || overlapError ? "practice-timing-warning" : "muted"
            }
          >
            {boundsError ||
              overlapError ||
              "Preview the full exercise before saving. Buttons adjust by 0.1 seconds."}
          </p>
          {error != null && <ErrorState error={error} />}
          <div className="practice-timing-actions">
            <button
              type="button"
              className="button secondary"
              disabled={busy || !!boundsError}
              onClick={() => {
                if (startMs !== undefined && endMs !== undefined)
                  onPreview({ start_ms: startMs, end_ms: endMs });
              }}
            >
              Preview timing
            </button>
            <button
              type="submit"
              className="button primary"
              disabled={busy || !changed || !!boundsError || !!overlapError}
            >
              {busy ? "Saving timing…" : "Save timing"}
            </button>
            <button
              type="button"
              className="text-link"
              disabled={busy}
              aria-label="Cancel timing edit"
              onClick={cancel}
            >
              Cancel
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
