import { describe, expect, it } from "vitest";
import {
  adjustAdjacentTiming,
  appendInterval,
  transcriptIssues,
} from "../src/features/transcriptValidation";
import type { Segment } from "../src/services/api";
const sentence = (
  start_ms: number,
  end_ms: number,
  text = "Original sentence",
): Segment => ({ text, speaker: "", start_ms, end_ms });
describe("Review timing corrections", () => {
  it("keeps the edited interval and moves both adjacent edges out of overlap", () => {
    const original = [
      sentence(0, 1300),
      sentence(1200, 2400),
      sentence(2300, 3200),
    ];
    const result = adjustAdjacentTiming(original, 1, "end_ms", 2500, 4000);
    expect(result.segments.map((s) => [s.start_ms, s.end_ms])).toEqual([
      [0, 1150],
      [1200, 2500],
      [2550, 3200],
    ]);
    expect(transcriptIssues(result.segments, 4000)).toEqual([]);
    expect(original.map((s) => [s.start_ms, s.end_ms])).toEqual([
      [0, 1300],
      [1200, 2400],
      [2300, 3200],
    ]);
  });
  it("leaves existing wider pauses intact", () => {
    const result = adjustAdjacentTiming(
      [sentence(0, 1000), sentence(1500, 2500), sentence(3000, 4000)],
      1,
      "start_ms",
      1400,
      5000,
    );
    expect(result.adjustments).toEqual([]);
    expect(result.segments[0].end_ms).toBe(1000);
    expect(result.segments[2].start_ms).toBe(3000);
  });
  it("does not erase an adjacent sentence when there is insufficient space", () => {
    const result = adjustAdjacentTiming(
      [sentence(100, 1000), sentence(1200, 2000)],
      1,
      "start_ms",
      120,
      3000,
    );
    expect(result.warning).toContain("not enough time");
    expect(result.adjustments).toEqual([]);
    expect(result.segments[0]).toEqual(sentence(100, 1000));
    expect(result.segments[1].start_ms).toBe(120);
  });
  it("does not silently clamp an edit beyond the recording", () => {
    const result = adjustAdjacentTiming(
      [sentence(0, 1000), sentence(1200, 2000)],
      1,
      "end_ms",
      3001,
      3000,
    );
    expect(result.segments[1].end_ms).toBe(3001);
    expect(result.adjustments).toEqual([]);
    expect(transcriptIssues(result.segments, 3000)[0].message).toContain(
      "3.000s",
    );
  });
  it("identifies empty segment 50 and refuses to append zero-length audio", () => {
    const rows = Array.from({ length: 49 }, (_, i) =>
      sentence(i * 9000, i === 48 ? 454947 : i * 9000 + 8000),
    );
    expect(appendInterval(rows, 454947)).toBeNull();
    const errors = transcriptIssues(
      [...rows, sentence(454947, 454947, "")],
      454947,
    );
    expect(errors.some((e) => e.index === 49 && e.field === "text")).toBe(true);
    expect(errors.some((e) => e.index === 49 && e.field === "end_ms")).toBe(
      true,
    );
  });
  it("only offers a manual interval in the unassigned audio at the end", () => {
    expect(appendInterval([sentence(0, 1000)], 1300)).toEqual({
      start_ms: 1000,
      end_ms: 1300,
    });
    expect(appendInterval([], 1300)).toEqual({ start_ms: 0, end_ms: 1300 });
  });
  it("flags fractional milliseconds and overlapping input instead of guessing positions", () => {
    const errors = transcriptIssues(
      [sentence(0, 1000), sentence(999, 1300.2)],
      2000,
    );
    expect(errors.map((e) => e.field)).toEqual(["start_ms", "end_ms"]);
  });
});
