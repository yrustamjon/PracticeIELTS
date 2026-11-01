import { fireEvent, render, screen, within } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { Passage, ReadingQuestions } from "../src/features/Reading";
const content = {
  title: "Original fixture",
  subtitle: "A test passage",
  instructions: "Answer every question.",
  paragraphs: [
    { label: "A", text: "First paragraph." },
    { label: "B", text: "Second paragraph." },
  ],
  groups: [
    {
      title: "Question 1",
      instructions: "Choose TRUE, FALSE or NOT GIVEN.",
      kind: "true_false",
      questions: [
        {
          number: 1,
          prompt: "This is a fixture.",
          max_words: 1,
          allow_number: false,
        },
      ],
      options: [],
      headers: [],
      rows: [],
    },
    {
      title: "Question 2",
      instructions: "ONE WORD ONLY.",
      kind: "table",
      questions: [{ number: 2, prompt: "", max_words: 1, allow_number: false }],
      options: [],
      headers: ["Place", "Date", "Feature", "Notes"],
      rows: [
        ["Original", "1700", "A {{2}} shelters people.", "Preserve all notes."],
        ["Another", "1800", "No blank in this row.", "Keep this row too."],
      ],
    },
  ],
};
it("preserves passage order and all table columns/rows with answer fields at markers", () => {
  render(
    <>
      <Passage content={content} />
      <ReadingQuestions
        content={content}
        answers={{ 1: "TRUE", 2: "pavilion" }}
        onChange={() => {}}
      />
    </>,
  );
  expect(
    screen
      .getByText("First paragraph.")
      .compareDocumentPosition(screen.getByText("Second paragraph.")) &
      Node.DOCUMENT_POSITION_FOLLOWING,
  ).toBeTruthy();
  expect(screen.getAllByRole("columnheader")).toHaveLength(4);
  expect(
    within(screen.getByRole("table")).getByLabelText("Question 2"),
  ).toHaveValue("pavilion");
  expect(screen.getByText("Keep this row too.")).toBeVisible();
  expect(screen.getByLabelText("Question 1")).toHaveValue("TRUE");
});
it("binds controls by their original question numbers and disables submitted answers", () => {
  const change = vi.fn();
  const { rerender } = render(
    <ReadingQuestions content={content} answers={{}} onChange={change} />,
  );
  fireEvent.change(screen.getByLabelText("Question 2"), {
    target: { value: "shelter" },
  });
  expect(change).toHaveBeenCalledWith(2, "shelter");
  fireEvent.change(screen.getByLabelText("Question 1"), {
    target: { value: "NOT GIVEN" },
  });
  expect(change).toHaveBeenCalledWith(1, "NOT GIVEN");
  rerender(
    <ReadingQuestions
      content={content}
      answers={{}}
      onChange={change}
      disabled
    />,
  );
  expect(screen.getByLabelText("Question 1")).toBeDisabled();
  expect(screen.getByLabelText("Question 2")).toBeDisabled();
});

it("renders short answers as labelled blanks without a second question number", () => {
  const shortContent = {
    ...content,
    groups: [
      {
        title: "Questions 6–8",
        instructions: "ONE WORD ONLY.",
        kind: "short_answer",
        questions: [
          {
            number: 6,
            prompt: "Which structure offers shelter?",
            max_words: 1,
            allow_number: false,
          },
        ],
        options: [],
        headers: [],
        rows: [],
      },
    ],
  };
  const { container } = render(
    <ReadingQuestions
      content={shortContent}
      answers={{ 6: "pavilion" }}
      onChange={() => {}}
    />,
  );
  expect(screen.getByLabelText("Question 6")).toHaveValue("pavilion");
  expect(container.querySelectorAll(".reading-question-number")).toHaveLength(
    1,
  );
  expect(
    container.querySelector(".reading-question--short .reading-number"),
  ).toBeNull();
  expect(container.querySelector("label")).toHaveAttribute(
    "for",
    "reading-answer-6",
  );
});

it.each(["headings", "matching", "choice"])(
  "shows complete %s options while saving source codes",
  (kind) => {
    const change = vi.fn();
    const labelled = {
      ...content,
      groups: [
        {
          ...content.groups[0],
          kind,
          options: ["i", "iv"],
          option_labels: { i: "Shelter", iv: "A boundary" },
        },
      ],
    };
    const { rerender } = render(
      <ReadingQuestions
        content={labelled}
        answers={{ 1: "iv" }}
        onChange={change}
      />,
    );
    expect(screen.getByLabelText("Question 1")).toHaveValue("iv");
    expect(screen.getByText("A boundary")).toBeVisible();
    expect(screen.getByRole("list", { name: "Answer options" })).toBeVisible();
    expect(screen.queryByRole("option", { name: /A boundary/ })).toBeNull();
    expect(screen.getByRole("option", { name: "iv" })).toHaveValue(
      "iv",
    );
    fireEvent.change(screen.getByLabelText("Question 1"), {
      target: { value: "i" },
    });
    expect(change).toHaveBeenCalledWith(1, "i");
    rerender(
      <ReadingQuestions
        content={labelled}
        answers={{ 1: "i" }}
        onChange={change}
        disabled
      />,
    );
    expect(screen.getByLabelText("Question 1")).toBeDisabled();
  },
);

it("binds completion fields inside their original note or summary text", () => {
  const change = vi.fn();
  const inline = {
    ...content,
    groups: [
      {
        ...content.groups[0],
        kind: "completion",
        text: "The {{1}} provides shade.",
        options: [],
      },
    ],
  };
  render(
    <ReadingQuestions
      content={inline}
      answers={{ 1: "roof" }}
      onChange={change}
    />,
  );
  const field = screen.getByLabelText("Question 1");
  expect(field).toHaveValue("roof");
  expect(field.closest("p")).toHaveTextContent("The 1 provides shade.");
  fireEvent.change(field, { target: { value: "canopy" } });
  expect(change).toHaveBeenCalledWith(1, "canopy");
});

it("shows a shared choose-two prompt and saves each numbered answer slot independently", () => {
  const change = vi.fn();
  const multi = {
    ...content,
    groups: [
      {
        ...content.groups[0],
        kind: "multiple_choice",
        text: "Which TWO features were found?",
        instructions: "Choose TWO letters in either order.",
        questions: [
          { number: 20, prompt: "", max_words: 1, allow_number: false },
          { number: 21, prompt: "", max_words: 1, allow_number: false },
        ],
        options: ["A", "B", "C"],
        option_labels: { A: "A roof", B: "A bell", C: "A wall" },
      },
    ],
  };
  const { rerender } = render(
    <ReadingQuestions
      content={multi}
      answers={{ 20: "C", 21: "A" }}
      onChange={change}
    />,
  );
  expect(screen.getByText("Which TWO features were found?")).toBeVisible();
  expect(screen.getByText("A roof")).toBeVisible();
  expect(within(screen.getByLabelText("Question 20")).getByRole("option", { name: "A", exact: true })).toHaveValue("A");
  expect(screen.getByLabelText("Question 20")).toHaveValue("C");
  expect(screen.getByLabelText("Question 21")).toHaveValue("A");
  fireEvent.change(screen.getByLabelText("Question 20"), {
    target: { value: "B" },
  });
  expect(change).toHaveBeenCalledWith(20, "B");
  rerender(
    <ReadingQuestions
      content={multi}
      answers={{ 20: "C", 21: "A" }}
      onChange={change}
      disabled
    />,
  );
  expect(screen.getByLabelText("Question 21")).toBeDisabled();
});

it("preserves source table captions and intentionally empty cells", () => {
  const table = {
    ...content,
    groups: [
      {
        ...content.groups[1],
        kind: "table",
        text: "Research findings",
        headers: ["", "Findings", "Comment"],
        rows: [["Humans", "{{2}}", ""]],
      },
    ],
  };
  render(
    <ReadingQuestions
      content={table}
      answers={{ 2: "shelter" }}
      onChange={() => {}}
    />,
  );
  expect(
    screen.getByRole("table", { name: "Research findings" }),
  ).toBeVisible();
  expect(screen.getByRole("columnheader", { name: "Item" })).toHaveTextContent(
    "",
  );
  expect(screen.getAllByRole("cell")).toHaveLength(3);
});

it("retains ordered flowchart steps, connectors and their original answer slots", () => {
  const flow = {
    ...content,
    groups: [
      {
        ...content.groups[0],
        kind: "completion",
        options: [],
        text: "Generating energy\nMix {{1}} with water\n↓\nLeave until {{2}} is complete",
        questions: [
          { number: 1, prompt: "", max_words: 2, allow_number: false },
          { number: 2, prompt: "", max_words: 2, allow_number: false },
        ],
      },
    ],
  };
  const { container } = render(
    <ReadingQuestions
      content={flow}
      answers={{ 1: "fuel", 2: "reaction" }}
      onChange={() => {}}
    />,
  );
  expect(container.querySelectorAll(".reading-flowchart > p")).toHaveLength(4);
  expect(container.querySelector(".reading-flow-arrow")).toHaveTextContent("↓");
  expect(screen.getByLabelText("Question 2")).toHaveValue("reaction");
});

it("retains an accessible source figure at its reviewed paragraph position", async () => {
  const transport = await import("../src/services/api");
  const request = vi
    .spyOn(transport, "apiBlob")
    .mockResolvedValue(new Blob(["fixture"], { type: "image/png" }));
  const create = vi
    .spyOn(URL, "createObjectURL")
    .mockReturnValue("blob:reviewed-map");
  const revoke = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
  const { unmount } = render(
    <Passage
      content={{
        ...content,
        figures: [
          {
            page: 1,
            crop: [0, 0, 0.5, 0.5],
            after_paragraph: 1,
            alt: "Original labelled test map",
          },
        ],
      }}
      figurePath={(index) => `reading-full-attempts/9/figures/3/${index}/`}
    />,
  );
  const picture = await screen.findByAltText("Original labelled test map");
  expect(request).toHaveBeenCalledWith("reading-full-attempts/9/figures/3/0/");
  expect(picture).toHaveAttribute("src", "blob:reviewed-map");
  expect(
    screen.getByText("First paragraph.").compareDocumentPosition(picture) &
      Node.DOCUMENT_POSITION_FOLLOWING,
  ).toBeTruthy();
  expect(
    picture.compareDocumentPosition(screen.getByText("Second paragraph.")) &
      Node.DOCUMENT_POSITION_FOLLOWING,
  ).toBeTruthy();
  unmount();
  expect(revoke).toHaveBeenCalledWith("blob:reviewed-map");
  request.mockRestore();
  create.mockRestore();
  revoke.mockRestore();
});

it("keeps a question diagram with its answer group without duplicating it in the passage", () => {
  const illustrated = {
    ...content,
    figures: [
      {
        page: 1,
        crop: [0, 0, 0.5, 0.5],
        after_paragraph: 0,
        alt: "Original diagram for the answer group",
      },
    ],
    groups: content.groups.map((group, index) => ({
      ...group,
      figure_indices: index === 0 ? [0] : [],
    })),
  };
  render(
    <>
      <Passage content={illustrated} />
      <ReadingQuestions
        content={illustrated}
        answers={{}}
        onChange={() => {}}
      />
    </>,
  );
  expect(
    screen.getAllByText("Original diagram for the answer group"),
  ).toHaveLength(1);
  expect(
    screen
      .getByText("Original diagram for the answer group")
      .closest("section"),
  ).toHaveTextContent("Question 1");
  expect(screen.getByLabelText("Question 1")).toBeInTheDocument();
});
