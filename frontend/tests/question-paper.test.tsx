import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { QuestionPaper } from "../src/components/QuestionPaper";
import type { ExamQuestion } from "../src/services/api";
function question(
  number: number,
  changes: Partial<ExamQuestion> = {},
): ExamQuestion {
  return {
    number,
    part: 1,
    type: "short_answer",
    prompt: `Detail ${number}: ____`,
    instructions: "Write ONE WORD ONLY for each answer.",
    options: [],
    max_words: 1,
    context: {},
    ...changes,
  };
}
describe("Existing text exam presentation", () => {
  it("shows one instruction for ten compact inline answers without per-row metadata", () => {
    const change = vi.fn();
    const { container } = render(
      <QuestionPaper
        questions={Array.from({ length: 10 }, (_, i) => question(i + 1))}
        answers={{ "3": "station" }}
        disabled={false}
        flags={[]}
        onAnswer={change}
      />,
    );
    expect(
      screen.getByRole("heading", { name: "Questions 1–10" }),
    ).toBeInTheDocument();
    expect(
      screen.getAllByText("Write ONE WORD ONLY for each answer."),
    ).toHaveLength(1);
    expect(
      container.querySelectorAll(
        ".question-kind, .question-tools, .exam-instructions",
      ),
    ).toHaveLength(0);
    expect(screen.getAllByRole("textbox")).toHaveLength(10);
    expect(screen.getByLabelText("Answer 3")).toHaveValue("station");
    expect(screen.getByLabelText("Answer 3")).toHaveAccessibleDescription(
      "Write ONE WORD ONLY for each answer.",
    );
    fireEvent.change(screen.getByLabelText("Answer 4"), {
      target: { value: "library" },
    });
    expect(change).toHaveBeenCalledWith(4, "library");
  });
  it("retains distinct instructions and context instead of dropping meaningful text", () => {
    render(
      <QuestionPaper
        questions={[
          question(1, { context: { body: "Booking details" } }),
          question(2, {
            instructions: "Write TWO WORDS.",
            context: { body: "Travel plans" },
          }),
        ]}
        answers={{}}
        disabled={false}
        flags={[]}
        onAnswer={() => {}}
      />,
    );
    expect(screen.getByText("Booking details")).toBeInTheDocument();
    expect(screen.getByText("Travel plans")).toBeInTheDocument();
    expect(screen.getByText("Write TWO WORDS.")).toBeInTheDocument();
    expect(screen.getAllByRole("heading")).toHaveLength(2);
  });
  it("prints shared context once while keeping every original question prompt", () => {
    render(
      <QuestionPaper
        questions={[
          question(1, { context: { body: "Booking details" } }),
          question(2, { context: { body: "Booking details" } }),
        ]}
        answers={{}}
        disabled={false}
        flags={[2]}
        onAnswer={() => {}}
      />,
    );
    expect(screen.getAllByText("Booking details")).toHaveLength(1);
    expect(screen.getByText("Detail 1:")).toBeInTheDocument();
    expect(screen.getByText("Detail 2:")).toBeInTheDocument();
  });
});
