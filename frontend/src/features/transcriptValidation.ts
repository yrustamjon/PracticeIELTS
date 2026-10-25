import type { Segment } from "../services/api";
export type TranscriptIssue = {
  index: number;
  field: "text" | "start_ms" | "end_ms";
  message: string;
};
export function transcriptIssues(
  segments: Segment[],
  duration?: number,
): TranscriptIssue[] {
  const errors: TranscriptIssue[] = [];
  let previousEnd = 0;
  segments.forEach((s, index) => {
    const add = (field: TranscriptIssue["field"], message: string) =>
      errors.push({ index, field, message });
    if (!s.text.trim())
      add("text", "Enter sentence text or remove this empty sentence.");
    else if (s.text.trim().length > 10000)
      add("text", "Use at most 10,000 characters.");
    const start = Number.isSafeInteger(s.start_ms),
      end = Number.isSafeInteger(s.end_ms);
    if (!start)
      add("start_ms", "Enter a start time using up to three decimal places.");
    else if (s.start_ms < 0)
      add("start_ms", "Start cannot be before 0 seconds.");
    else if (s.start_ms < previousEnd)
      add(
        "start_ms",
        `Start must be at least ${(previousEnd / 1000).toFixed(3)}s, after sentence ${index}.`,
      );
    if (!end)
      add("end_ms", "Enter an end time using up to three decimal places.");
    else if (start && s.end_ms <= s.start_ms)
      add(
        "end_ms",
        "End must be later than start. Adjust the timing or remove this sentence.",
      );
    else if (duration !== undefined && s.end_ms > duration)
      add(
        "end_ms",
        `End must be at most ${(duration / 1000).toFixed(3)}s, the end of the recording.`,
      );
    if (end) previousEnd = Math.max(previousEnd, s.end_ms);
  });
  return errors;
}
export function appendInterval(
  segments: Segment[],
  duration: number | undefined,
): { start_ms: number; end_ms: number } | null {
  if (!Number.isSafeInteger(duration) || !duration) return null;
  const start = segments.at(-1)?.end_ms || 0;
  if (!Number.isSafeInteger(start) || start < 0 || start >= duration)
    return null;
  return { start_ms: start, end_ms: duration };
}

export const NEIGHBOR_GAP_MS = 50;
export type TimingAdjustment = {
  index: number;
  field: "start_ms" | "end_ms";
  value: number;
};
export function adjustAdjacentTiming(
  segments: Segment[],
  index: number,
  field: "start_ms" | "end_ms",
  value: number,
  duration?: number,
): { segments: Segment[]; adjustments: TimingAdjustment[]; warning?: string } {
  const next = segments.map((s, i) =>
      i === index ? { ...s, [field]: value } : s,
    ),
    edited = next[index];
  const adjustments: TimingAdjustment[] = [];
  if (
    !edited ||
    !Number.isSafeInteger(edited.start_ms) ||
    !Number.isSafeInteger(edited.end_ms) ||
    edited.start_ms < 0 ||
    edited.end_ms <= edited.start_ms ||
    (duration !== undefined && edited.end_ms > duration)
  )
    return { segments: next, adjustments };
  const previous = next[index - 1],
    following = next[index + 1];
  const previousEnd = edited.start_ms - NEIGHBOR_GAP_MS,
    nextStart = edited.end_ms + NEIGHBOR_GAP_MS;
  const trimPrevious = previous && previous.end_ms > previousEnd,
    trimNext = following && following.start_ms < nextStart;
  // Keep the user's chosen interval and never erase a neighboring sentence.
  if (trimPrevious && previousEnd <= previous.start_ms)
    return {
      segments: next,
      adjustments,
      warning: `There is not enough time left for sentence ${index}. Adjust its start or choose a later boundary.`,
    };
  if (trimNext && nextStart >= following.end_ms)
    return {
      segments: next,
      adjustments,
      warning: `There is not enough time left for sentence ${index + 2}. Adjust its end or choose an earlier boundary.`,
    };
  if (trimPrevious) {
    next[index - 1] = { ...previous, end_ms: previousEnd };
    adjustments.push({ index: index - 1, field: "end_ms", value: previousEnd });
  }
  if (trimNext) {
    next[index + 1] = { ...following, start_ms: nextStart };
    adjustments.push({ index: index + 1, field: "start_ms", value: nextStart });
  }
  return { segments: next, adjustments };
}
