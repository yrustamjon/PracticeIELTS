import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { QuestionStudio } from "../src/features/QuestionStudio";
import { api } from "../src/services/api";
vi.mock("../src/services/api", () => ({ api: vi.fn() }));
vi.mock("../src/components/PdfQuestionPage", () => ({
  default: () => <div>Original PDF with fields</div>,
}));
vi.mock("../src/components/PrivateImage", () => ({
  PrivateImage: () => <div>Private editor preview</div>,
}));
const q = {
  number: 1,
  part: 1,
  type: "short_answer",
  prompt: "Original question",
  instructions: "ONE WORD",
  options: [],
  answers: ["station"],
  max_words: 1,
  context: {},
};
const onSaved = vi.fn(),
  onDirty = vi.fn();
function setup() {
  vi.mocked(api).mockImplementation(async (path, options) => {
    if (path.endsWith("question-document/"))
      return {
        id: 22,
        page_count: 2,
        extraction_state: "extracted",
        extracted_text: "New PDF text",
      } as never;
    if (path.endsWith("question-drafts/"))
      return {
        questions: [
          { ...q, prompt: "Imported complete question", answers: [] },
        ],
        source_text: "Question text",
        warnings: ["Review the draft."],
      } as never;
    return {
      id: options?.method === "PUT" ? 2 : 1,
      audio: 10,
      document: 11,
      document_pages: [1],
      duration_seconds: 60,
      questions: [q],
      presentation: "text",
    } as never;
  });
  const cache = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  render(
    <QueryClientProvider client={cache}>
      <QuestionStudio
        materialId={1}
        audioId={10}
        audioReady
        onSaved={onSaved}
        onDirty={onDirty}
      />
    </QueryClientProvider>,
  );
}
beforeEach(() => vi.clearAllMocks());
describe("Reviewed PDF text import", () => {
  it("keeps the saved PDF association when only the duration changes", async () => {
    setup();
    await waitFor(() =>
      expect(screen.getByLabelText("Question 1 prompt")).toHaveValue(
        "Original question",
      ),
    );
    fireEvent.change(screen.getByLabelText("Timed exam limit in minutes"), {
      target: { value: "2" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Save exam questions" }),
    );
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    const call = vi
      .mocked(api)
      .mock.calls.find(([, options]) => options?.method === "PUT")!;
    expect(JSON.parse(String(call[1]?.body))).toMatchObject({
      document: 11,
      document_pages: [1],
      presentation: "text",
    });
  });
  it("uses actual imported prompts and preserves the matching prior answer key", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    setup();
    await waitFor(() =>
      expect(screen.getByLabelText("Question 1 prompt")).toHaveValue(
        "Original question",
      ),
    );
    fireEvent.click(
      screen.getByRole("button", {
        name: "Create editable questions from PDF",
      }),
    );
    await waitFor(() =>
      expect(screen.getByLabelText("Question 1 prompt")).toHaveValue(
        "Imported complete question",
      ),
    );
    expect(screen.getByLabelText("Question 1 answers")).toHaveValue("station");
    expect(screen.getByText("Review the draft.")).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", { name: "Save exam questions" }),
    );
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    const call = vi
      .mocked(api)
      .mock.calls.find(([, options]) => options?.method === "PUT")!;
    expect(JSON.parse(String(call[1]?.body))).toMatchObject({
      document: 22,
      presentation: "pdf",
      questions: [
        { prompt: "Imported complete question", answers: ["station"] },
      ],
    });
  });
});
