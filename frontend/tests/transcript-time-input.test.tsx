import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { TranscriptTimeInput } from "../src/features/TranscriptTimeInput";

describe("Review time entry", () => {
  const props = {
    milliseconds: 12400,
    label: "Sentence start",
    disabled: false,
    invalid: false,
    duration: 20000,
  };
  it("commits the completed time on blur, not the partial values while typing", () => {
    const onCommit = vi.fn();
    render(<TranscriptTimeInput {...props} onCommit={onCommit} />);
    const field = screen.getByLabelText("Sentence start");
    fireEvent.change(field, { target: { value: "1" } });
    fireEvent.change(field, { target: { value: "12.325" } });
    expect(onCommit).not.toHaveBeenCalled();
    fireEvent.blur(field);
    expect(onCommit).toHaveBeenCalledExactlyOnceWith(12325);
  });
  it("keeps a cleared time invalid instead of turning it into zero", () => {
    const onCommit = vi.fn();
    render(<TranscriptTimeInput {...props} onCommit={onCommit} />);
    fireEvent.change(screen.getByLabelText("Sentence start"), {
      target: { value: "" },
    });
    fireEvent.blur(screen.getByLabelText("Sentence start"));
    expect(onCommit).toHaveBeenCalledExactlyOnceWith(NaN);
  });
  it("updates the field when an adjacent edit or Undo changes its time", () => {
    const onCommit = vi.fn();
    const { rerender } = render(
      <TranscriptTimeInput {...props} onCommit={onCommit} />,
    );
    rerender(
      <TranscriptTimeInput
        {...props}
        milliseconds={12550}
        onCommit={onCommit}
      />,
    );
    expect(screen.getByLabelText("Sentence start")).toHaveValue(12.55);
    expect(onCommit).not.toHaveBeenCalled();
  });
});
