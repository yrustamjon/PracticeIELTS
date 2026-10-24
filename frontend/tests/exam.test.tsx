import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { QuestionControl } from "../src/components/ExamQuestion";
import type { ExamQuestion } from "../src/services/api";
const question: ExamQuestion = {
  number: 1,
  part: 1,
  type: "sentence_completion",
  prompt: "Meet at the ____ before nine.",
  instructions: "ONE WORD",
  options: [],
  max_words: 1,
  context: {},
};
describe("Interactive exam questions", () => {
  it("puts one editable field in the sentence without rendering an image", () => {
    const onChange = vi.fn();
    const { container } = render(
      <QuestionControl
        question={question}
        value=""
        disabled={false}
        onChange={onChange}
      />,
    );
    const input = screen.getByRole("textbox", { name: "Answer 1" });
    expect(input.closest(".exam-prompt")).not.toBeNull();
    fireEvent.change(input, { target: { value: "station" } });
    expect(onChange).toHaveBeenCalledWith("station");
    expect(container.querySelectorAll("input")).toHaveLength(1);
    expect(
      container.querySelectorAll("img, canvas, iframe, object"),
    ).toHaveLength(0);
  });
  it("places the answer in a table cell, keeping headings readable", () => {
    render(
      <QuestionControl
        question={{
          ...question,
          type: "table_completion",
          prompt: "Complete the timetable.",
          context: {
            table: [
              ["Time", "Place"],
              ["9am", "____"],
            ],
          },
        }}
        value="station"
        disabled={false}
        onChange={() => {}}
      />,
    );
    const input = screen.getByRole("textbox", { name: "Answer 1" });
    expect(input.closest("td")).not.toBeNull();
    expect(input).toHaveValue("station");
    expect(
      screen.getByRole("columnheader", { name: "Time" }),
    ).toBeInTheDocument();
  });
  it("enforces multi-select limits while letting a selected option be removed", () => {
    const onChange = vi.fn();
    render(
      <QuestionControl
        question={{
          ...question,
          type: "multiple_choice",
          selections: 2,
          options: [
            { key: "A", text: "Station" },
            { key: "B", text: "Library" },
            { key: "C", text: "Park" },
          ],
        }}
        value={["A", "B"]}
        disabled={false}
        onChange={onChange}
      />,
    );
    expect(screen.getByRole("checkbox", { name: "C. Park" })).toBeDisabled();
    fireEvent.click(screen.getByRole("checkbox", { name: "A. Station" }));
    expect(onChange).toHaveBeenCalledWith(["B"]);
  });
  it("flags review without changing the answer and escapes supplied markup", () => {
    const onFlag = vi.fn(),
      onChange = vi.fn();
    const { container } = render(
      <QuestionControl
        question={{ ...question, prompt: "<img src=x> ____" }}
        value="station"
        flagged
        disabled={false}
        onChange={onChange}
        onFlag={onFlag}
      />,
    );
    const review = screen.getByRole("button", {
      name: "Mark question 1 for review",
    });
    expect(review).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(review);
    expect(onFlag).toHaveBeenCalledOnce();
    expect(onChange).not.toHaveBeenCalled();
    expect(container.querySelector("img")).toBeNull();
    expect(screen.getByRole("textbox", { name: "Answer 1" })).toHaveValue(
      "station",
    );
  });
});
