import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { HtmlQuestionPaper } from "../src/components/HtmlQuestionPaper";
import type { ExamQuestion } from "../src/services/api";
const questions: ExamQuestion[] = [
  {
    number: 1,
    part: 1,
    type: "short_answer",
    prompt: "Meeting point",
    instructions: "ONE WORD",
    max_words: 1,
    options: [],
    context: {},
  },
  {
    number: 2,
    part: 1,
    type: "multiple_choice",
    prompt: "Choose a room",
    instructions: "Choose one",
    max_words: 1,
    options: [
      { key: "A", text: "Upstairs" },
      { key: "B", text: "Downstairs" },
    ],
    context: {},
  },
];
describe("Native formatted exam paper", () => {
  it("retains complete notes and places a working answer inside the sentence", () => {
    const change = vi.fn();
    const { container } = render(
      <HtmlQuestionPaper
        sections={[
          {
            part: 1,
            html: "<h3>Library visit</h3><ul><li>Meet at {{1}} before nine.</li></ul>",
          },
        ]}
        questions={questions}
        answers={{}}
        onAnswer={change}
      />,
    );
    expect(
      screen.getByRole("heading", { name: "Library visit" }),
    ).toBeInTheDocument();
    const input = screen.getByLabelText("Answer 1");
    expect(input.closest("li")).not.toBeNull();
    fireEvent.change(input, { target: { value: "station" } });
    expect(change).toHaveBeenCalledWith(1, "station");
    expect(container.querySelector("canvas, img, iframe")).toBeNull();
  });
  it("binds radio controls in existing labels without showing answer keys", () => {
    const change = vi.fn();
    render(
      <HtmlQuestionPaper
        sections={[
          {
            part: 1,
            html: "<p>Choose a room.</p><label>{{2:A}} A Upstairs</label><label>{{2:B}} B Downstairs</label>",
          },
        ]}
        questions={questions}
        answers={{ "2": "B" }}
        onAnswer={change}
      />,
    );
    expect(
      screen.getByRole("radio", { name: "2: B. Downstairs" }),
    ).toBeChecked();
    fireEvent.click(screen.getByRole("radio", { name: "2: A. Upstairs" }));
    expect(change).toHaveBeenCalledWith(2, "A");
  });
  it("ignores active source markup even if server filtering were absent", () => {
    const { container } = render(
      <HtmlQuestionPaper
        sections={[
          {
            part: 1,
            html: '<script>alert(1)</script><img src="https://example.invalid/x"><iframe src="x"></iframe><p onclick="alert(1)">{{1}}</p>',
          },
        ]}
        questions={questions}
        answers={{}}
        onAnswer={() => {}}
      />,
    );
    expect(
      container.querySelector("script, img, iframe, [onclick]"),
    ).toBeNull();
    expect(screen.getByLabelText("Answer 1")).toBeInTheDocument();
  });
  it("supports multiple selections at a single generic answer marker", () => {
    const change = vi.fn();
    render(
      <HtmlQuestionPaper
        sections={[{ part: 1, html: "<p>Choose two rooms: {{2}}</p>" }]}
        questions={[{ ...questions[1], selections: 2 }]}
        answers={{ "2": ["A"] }}
        onAnswer={change}
      />,
    );
    fireEvent.click(screen.getByRole("checkbox", { name: "2: B. Downstairs" }));
    expect(change).toHaveBeenCalledWith(2, ["A", "B"]);
  });
});
