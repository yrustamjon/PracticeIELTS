import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, expect, it, vi } from "vitest";
import {
  ReadingImport,
  ReadingImportDetail,
} from "../src/features/ReadingImport";
import { useAuth } from "../src/stores/auth";
vi.mock("../src/services/api", () => ({
  api: vi.fn(),
  post: vi.fn(),
  apiBlob: vi.fn(),
}));
import { api, post, apiBlob } from "../src/services/api";
const capabilities = {
  available: true,
  provider: "ocr",
  model: "",
  review_model: "",
  reason: "",
  max_file_mb: 50,
  max_pages: 200,
};
const job = {
  id: 7,
  book: "Original book",
  source_name: "original.pdf",
  source_page_count: 3,
  state: "needs_review",
  stage: "ready_for_review",
  progress: {},
  metrics: { processing_mode: "ocr_only" },
  error_code: "",
  error_message: "",
  created_at: "2026-10-28T00:00:00Z",
  published_papers: [],
  extracted_pages: [
    {
      page: 1,
      text: "A pavilion shelters visitors.",
      method: "ocr",
      warnings: [],
    },
  ],
  findings: [
    {
      id: "missing-key",
      candidate_index: 0,
      stage: "validation",
      severity: "error",
      message: "The source answer key needs checking.",
      source_pages: [3],
      resolved: false,
    },
  ],
  candidates: [
    {
      book: "Original book",
      test: 1,
      passage: 1,
      source_pages: [1, 2],
      key_pages: [3],
      keys: { "1": ["pavilion"] },
      content: {
        title: "Original passage",
        subtitle: "",
        instructions: "Answer the question.",
        paragraphs: [{ label: "A", text: "A pavilion shelters visitors." }],
        groups: [
          {
            title: "Question 1",
            instructions: "ONE WORD ONLY.",
            kind: "short_answer",
            questions: [
              {
                number: 1,
                prompt: "What shelters visitors?",
                max_words: 1,
                allow_number: false,
              },
            ],
            options: [],
            headers: [],
            rows: [],
          },
        ],
      },
    },
  ],
};
function auth(edit = true) {
  useAuth.getState().set("test", {
    id: 1,
    username: "editor",
    email: "",
    role: edit ? "teacher" : "student",
    can_edit: edit,
  });
}
function show(path = "/admin/reading/import") {
  // Most cases configure the detail API; provide its independent paper-list dependency.
  const configured = vi.mocked(api).getMockImplementation()!;
  vi.mocked(api).mockImplementation(async (requestPath, options) => {
    const result = await configured(requestPath, options);
    return requestPath.startsWith("reading-papers/") && !(result && typeof result === "object" && "results" in result)
      ? {results: [], count: 0, next: null, previous: null}
      : result;
  });
  return render(
    <QueryClientProvider
      client={
        new QueryClient({
          defaultOptions: { queries: { retry: false, gcTime: 0 } },
        })
      }
    >
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/admin" element={<h1>Admin destination</h1>} />
          <Route path="/admin/reading" element={<h1>Reading destination</h1>} />
          <Route path="/admin/reading/import" element={<ReadingImport />} />
          <Route
            path="/admin/reading/imports/:id"
            element={<ReadingImportDetail />}
          />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}
afterEach(() => {
  cleanup();
  vi.resetAllMocks();
  useAuth.getState().clear();
});
it("rejects student access without fetching private import data", () => {
  auth(false);
  show();
  expect(screen.getByRole("alert")).toHaveTextContent("Editor access");
  expect(api).not.toHaveBeenCalled();
});
it("offers PDF extraction without claiming ML preparation or verification", async () => {
  auth();
  vi.mocked(api).mockImplementation(async (path) =>
    path === "reading-imports/capabilities/"
      ? capabilities
      : { results: [], count: 0, next: null, previous: null },
  );
  show();
  await waitFor(() =>
    expect(
      screen.getByRole("button", { name: "Upload & extract text" }),
    ).toBeEnabled(),
  );
  expect(screen.getByText(/ML preparation is not enabled/)).toBeVisible();
  expect(screen.queryByText(/90%/)).toBeNull();
  expect(screen.getByLabelText("Original PDF")).toHaveAttribute("type", "file");
});
it("retains the selected book and test when adding a passage from actual source pages", async () => {
  auth();
  vi.mocked(apiBlob).mockImplementation(() => new Promise(() => {}));
  vi.mocked(api).mockImplementation(async (path) =>
    path.startsWith("reading-papers/")
      ? {
          results: [{ book: "Cambridge 10", test: 2, passage: 1 }],
          count: 1,
          next: null,
          previous: null,
        }
      : { ...job, book: "Cambridge 10", candidates: [], findings: [] },
  );
  show("/admin/reading/imports/7?book=Cambridge+10&test=2");
  fireEvent.click(
    await screen.findByRole("checkbox", { name: "PDF page 1 · OCR draft" }),
  );
  fireEvent.click(
    screen.getByRole("button", { name: "Add passage from selected pages" }),
  );
  expect(screen.getByLabelText("Book")).toHaveValue("Cambridge 10");
  expect(screen.getByLabelText("Test")).toHaveValue(2);
  expect(screen.getByLabelText("Passage")).toHaveValue(2);
});
it("requires saved explicit resolutions and full manual comparison before publication", async () => {
  auth();
  let saved = false;
  vi.mocked(apiBlob).mockImplementation(() => new Promise(() => {}));
  vi.mocked(api).mockImplementation(async (path, options) => {
    if (options?.method === "PATCH") {
      saved = true;
      return {
        ...job,
        findings: [
          {
            ...job.findings[0],
            resolved: true,
            resolution_note: "Compared with the original key.",
          },
        ],
      };
    }
    return saved
      ? {
          ...job,
          findings: [
            {
              ...job.findings[0],
              resolved: true,
              resolution_note: "Compared with the original key.",
            },
          ],
        }
      : job;
  });
  show("/admin/reading/imports/7");
  const publish = await screen.findByRole("button", {
    name: "Publish this reviewed passage",
  });
  expect(publish).toBeDisabled();
  expect(screen.getByLabelText("Question 1 wording")).toHaveValue(
    "What shelters visitors?",
  );
  fireEvent.change(
    screen.getByLabelText("Question 1 accepted answers · one variant per line"),
    { target: { value: "pavilions" } },
  );
  fireEvent.change(screen.getByLabelText("Resolution note for missing-key"), {
    target: { value: "Compared with the original key." },
  });
  fireEvent.click(
    screen.getByRole("button", { name: "Save corrections & resolutions" }),
  );
  await waitFor(() =>
    expect(api).toHaveBeenCalledWith(
      "reading-imports/7/",
      expect.objectContaining({ method: "PATCH" }),
    ),
  );
  const patch = vi
    .mocked(api)
    .mock.calls.find(([, o]) => o?.method === "PATCH")!;
  const payload = JSON.parse(String(patch[1]?.body));
  expect(payload.candidates[0].keys["1"]).toEqual(["pavilions"]);
  expect(payload.resolutions).toEqual([
    {
      finding_id: "missing-key",
      resolution_note: "Compared with the original key.",
    },
  ]);
  await screen.findByText("Resolution: Compared with the original key.");
  expect(publish).toBeDisabled();
  fireEvent.click(
    screen.getByRole("checkbox", {
      name: /I manually compared this complete passage/,
    }),
  );
  expect(publish).toBeEnabled();
  vi.mocked(post).mockResolvedValue({ paper: 3, version: 5 });
  fireEvent.click(publish);
  await waitFor(() =>
    expect(post).toHaveBeenCalledWith("reading-imports/7/approve/", {
      candidate_index: 0,
      confirm_review: true,
      confirm_manual_review: true,
    }),
  );
});
it("creates an editable passage only from selected actual extracted text without invented questions or keys", async () => {
  auth();
  vi.mocked(apiBlob).mockImplementation(() => new Promise(() => {}));
  vi.mocked(api).mockResolvedValue({ ...job, candidates: [], findings: [] });
  show("/admin/reading/imports/7");
  fireEvent.click(
    await screen.findByRole("checkbox", { name: "PDF page 1 · OCR draft" }),
  );
  fireEvent.click(
    screen.getByRole("button", { name: "Add passage from selected pages" }),
  );
  expect(await screen.findByLabelText("Paragraph 1 text")).toHaveValue(
    "A pavilion shelters visitors.",
  );
  expect(screen.getByLabelText("Passage title")).toHaveValue("");
  expect(screen.queryByLabelText(/accepted answers/)).toBeNull();
  fireEvent.click(
    screen.getByRole("button", { name: "Save corrections & resolutions" }),
  );
  await waitFor(() =>
    expect(api).toHaveBeenCalledWith(
      "reading-imports/7/",
      expect.objectContaining({ method: "PATCH" }),
    ),
  );
  const patch = vi
    .mocked(api)
    .mock.calls.find(([, o]) => o?.method === "PATCH")!;
  const data = JSON.parse(String(patch[1]?.body));
  expect(data.candidates[0].keys).toEqual({});
  expect(data.candidates[0].content.groups).toEqual([]);
  expect(data.candidates[0].source_pages).toEqual([1]);
});
it("displays actual persisted page progress without an invented confidence score", async () => {
  auth();
  vi.mocked(api).mockResolvedValue({
    ...job,
    state: "running",
    stage: "ocr",
    progress: { current: 2, total: 3 },
    candidates: [],
    findings: [],
  });
  show("/admin/reading/imports/7");
  expect(await screen.findByText("2 / 3 pages processed")).toBeVisible();
  expect(screen.getByText("Recognising scanned text")).toBeVisible();
  expect(screen.queryByText(/90%/i)).toBeNull();
  expect(
    screen.queryByRole("button", { name: "Publish this reviewed passage" }),
  ).toBeNull();
});

it("appends a new editable passage after earlier passages are published while keeping the published slot disabled", async () => {
  auth();
  vi.mocked(apiBlob).mockImplementation(() => new Promise(() => {}));
  vi.mocked(api).mockResolvedValue({
    ...job,
    state: "completed",
    stage: "published",
    metrics: { processing_mode: "ocr_only", model_calls: 0 },
    published_papers: [{ candidate_index: 0, paper: 3, version: 5 }],
    findings: [],
  });
  show("/admin/reading/imports/7");
  expect(await screen.findByLabelText("Passage title")).toBeDisabled();
  expect(screen.queryByText("0 model calls recorded")).toBeNull();
  expect(
    screen.getByText("1 source pages extracted / 3 source pages"),
  ).toBeVisible();
  expect(screen.getByText("Text and table passages only")).toBeVisible();
  fireEvent.click(
    screen.getByRole("checkbox", { name: "PDF page 1 · OCR draft" }),
  );
  fireEvent.click(
    screen.getByRole("button", { name: "Add passage from selected pages" }),
  );
  expect(screen.getByLabelText("Passage title")).toBeEnabled();
  expect(
    screen.getByRole("checkbox", {
      name: /I manually compared.*needs no images or diagrams/,
    }),
  ).toBeVisible();
  fireEvent.change(screen.getByLabelText("Passage title"), {
    target: { value: "Next passage" },
  });
  fireEvent.click(
    screen.getByRole("button", { name: "Save corrections & resolutions" }),
  );
  await waitFor(() =>
    expect(api).toHaveBeenCalledWith(
      "reading-imports/7/",
      expect.objectContaining({ method: "PATCH" }),
    ),
  );
  const patch = vi
    .mocked(api)
    .mock.calls.find(([, o]) => o?.method === "PATCH")!;
  const data = JSON.parse(String(patch[1]?.body));
  expect(data.candidates).toHaveLength(2);
  expect(data.candidates[0]).toEqual(job.candidates[0]);
  expect(data.candidates[1].content.title).toBe("Next passage");
});

it("shows clickable parent breadcrumbs and the actual selected book/test/passage context", async () => {
  auth();
  vi.mocked(apiBlob).mockImplementation(() => new Promise(() => {}));
  vi.mocked(api).mockResolvedValue(job);
  show("/admin/reading/imports/7");
  const nav = await screen.findByRole("navigation", {
    name: "Reading location",
  });
  expect(
    within(nav).getByRole("link", { name: "Admin", exact: true }),
  ).toHaveAttribute("href", "/admin");
  expect(
    within(nav).getByRole("link", { name: "Reading", exact: true }),
  ).toHaveAttribute("href", "/admin/reading");
  expect(
    within(nav).getByRole("link", { name: "PDF imports", exact: true }),
  ).toHaveAttribute("href", "/admin/reading/import");
  expect(within(nav).getByText("original.pdf")).toHaveAttribute(
    "aria-current",
    "page",
  );
  const context = screen.getByLabelText("Current passage context");
  expect(context).toHaveTextContent("Original book");
  expect(context).toHaveTextContent("Test 1");
  expect(context).toHaveTextContent("Passage 1");
  expect(screen.getByText("No unsaved corrections")).toBeVisible();
});
it("stays on the source review with corrections intact if saving before parent navigation fails", async () => {
  auth();
  vi.mocked(apiBlob).mockImplementation(() => new Promise(() => {}));
  vi.mocked(api).mockImplementation(async (_path, options) => {
    if (options?.method === "PATCH")
      throw new Error("Corrections could not be saved.");
    return job;
  });
  show("/admin/reading/imports/7");
  const input = await screen.findByLabelText("Resolution note for missing-key");
  fireEvent.change(input, { target: { value: "Keep my comparison note." } });
  expect(screen.getByText("Unsaved corrections")).toBeVisible();
  fireEvent.click(
    within(
      screen.getByRole("navigation", { name: "Reading location" }),
    ).getByRole("link", { name: "Reading", exact: true }),
  );
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Corrections could not be saved.",
  );
  expect(
    screen.queryByRole("heading", { name: "Reading destination" }),
  ).toBeNull();
  expect(screen.getByLabelText("Resolution note for missing-key")).toHaveValue(
    "Keep my comparison note.",
  );
  expect(screen.getByText("Unsaved corrections")).toBeVisible();
});
it("waits for the actual corrections save before navigating to a parent", async () => {
  auth();
  vi.mocked(apiBlob).mockImplementation(() => new Promise(() => {}));
  let finishSave: (value: unknown) => void = () => {};
  const pendingSave = new Promise((resolve) => {
    finishSave = resolve;
  });
  vi.mocked(api).mockImplementation(async (_path, options) =>
    options?.method === "PATCH" ? pendingSave : job,
  );
  show("/admin/reading/imports/7");
  fireEvent.change(await screen.findByLabelText("Question 1 wording"), {
    target: { value: "Corrected source question." },
  });
  fireEvent.click(
    within(
      screen.getByRole("navigation", { name: "Reading location" }),
    ).getByRole("link", { name: "Admin", exact: true }),
  );
  await screen.findByText("Saving corrections…");
  expect(
    screen.queryByRole("heading", { name: "Admin destination" }),
  ).toBeNull();
  finishSave(job);
  expect(
    await screen.findByRole("heading", { name: "Admin destination" }),
  ).toBeVisible();
  const patch = vi
    .mocked(api)
    .mock.calls.find(([, options]) => options?.method === "PATCH")!;
  expect(
    JSON.parse(String(patch[1]?.body)).candidates[0].content.groups[0]
      .questions[0].prompt,
  ).toBe("Corrected source question.");
});

it("removes draft questions, groups and table rows without renumbering or deleting retained keys and markers", async () => {
  auth();
  vi.mocked(apiBlob).mockImplementation(() => new Promise(() => {}));
  const candidate = structuredClone(job.candidates[0]);
  candidate.keys = {
    "1": ["pavilion"],
    "2": ["shelter"],
    "3": ["visitor"],
    "4": ["water"],
  };
  candidate.content.groups.push({
    title: "Questions 2–3",
    instructions: "ONE WORD ONLY.",
    kind: "short_answer",
    questions: [
      { number: 2, prompt: "Question two", max_words: 1, allow_number: false },
      {
        number: 3,
        prompt: "Question three",
        max_words: 1,
        allow_number: false,
      },
    ],
    options: [],
    headers: [],
    rows: [],
  });
  candidate.content.groups.push({
    title: "Question 4",
    instructions: "Complete the table.",
    kind: "table",
    questions: [{ number: 4, prompt: "", max_words: 1, allow_number: false }],
    options: [],
    headers: ["Place", "Feature"],
    rows: [
      ["Extra row", "Context"],
      ["Well", "Collects {{4}}"],
    ],
  });
  vi.mocked(api).mockResolvedValue({
    ...job,
    candidates: [candidate],
    findings: [],
  });
  show("/admin/reading/imports/7");
  fireEvent.click(
    await screen.findByRole("button", {
      name: "Remove question 2",
      exact: true,
    }),
  );
  expect(screen.queryByLabelText("Question 2 wording")).toBeNull();
  expect(screen.getByLabelText("Question 3 wording")).toHaveValue(
    "Question three",
  );
  fireEvent.click(
    screen.getByRole("button", { name: "Remove table row 1", exact: true }),
  );
  fireEvent.click(
    screen.getByRole("button", {
      name: "Remove question group 1",
      exact: true,
    }),
  );
  expect(screen.queryByLabelText("Question 1 wording")).toBeNull();
  fireEvent.click(
    screen.getByRole("button", { name: "Save corrections & resolutions" }),
  );
  await waitFor(() =>
    expect(api).toHaveBeenCalledWith(
      "reading-imports/7/",
      expect.objectContaining({ method: "PATCH" }),
    ),
  );
  const patch = vi
    .mocked(api)
    .mock.calls.find(([, o]) => o?.method === "PATCH")!;
  const saved = JSON.parse(String(patch[1]?.body)).candidates[0];
  expect(saved.keys).toEqual({ "3": ["visitor"], "4": ["water"] });
  expect(
    saved.content.groups.flatMap((g: { questions: { number: number }[] }) =>
      g.questions.map((q) => q.number),
    ),
  ).toEqual([3, 4]);
  expect(saved.content.groups[1].rows).toEqual([["Well", "Collects {{4}}"]]);
});
it("keeps all removal controls disabled on an already published passage", async () => {
  auth();
  vi.mocked(apiBlob).mockImplementation(() => new Promise(() => {}));
  vi.mocked(api).mockResolvedValue({
    ...job,
    state: "completed",
    published_papers: [{ candidate_index: 0, paper: 3, version: 5 }],
    findings: [],
  });
  show("/admin/reading/imports/7");
  expect(
    await screen.findByRole("button", {
      name: "Remove question 1",
      exact: true,
    }),
  ).toBeDisabled();
  expect(
    screen.getByRole("button", {
      name: "Remove question group 1",
      exact: true,
    }),
  ).toBeDisabled();
});

it("persists full heading labels with answer codes and removes labels for deleted options", async () => {
  auth();
  vi.mocked(apiBlob).mockImplementation(() => new Promise(() => {}));
  let currentJob = structuredClone(job);
  vi.mocked(api).mockImplementation(async (path, options) => {
    if (options?.method === "PATCH") currentJob = {...currentJob, ...JSON.parse(String(options.body))};
    return currentJob;
  });
  show("/admin/reading/imports/7");
  fireEvent.change(await screen.findByLabelText("Group 1 question type"), {target:{value:"headings"}});
  fireEvent.change(screen.getByLabelText("Group 1 options · one per line"), {target:{value:"i\niv"}});
  fireEvent.change(screen.getByLabelText("Group 1 option i text"), {target:{value:"Shelter"}});
  fireEvent.change(screen.getByLabelText("Group 1 option iv text"), {target:{value:"A boundary"}});
  fireEvent.click(screen.getByRole("button", {name:"Save corrections & resolutions"}));
  await waitFor(() => expect(vi.mocked(api).mock.calls.some(([, options]) => options?.method === "PATCH")).toBe(true));
  const patch = vi.mocked(api).mock.calls.find(([, options]) => options?.method === "PATCH")!;
  const group = JSON.parse(String(patch[1]?.body)).candidates[0].content.groups[0];
  expect(group).toMatchObject({kind:"headings", options:["i","iv"], option_labels:{i:"Shelter",iv:"A boundary"}});
  await waitFor(() => expect(screen.getByText("No unsaved corrections")).toBeVisible());
  fireEvent.change(screen.getByLabelText("Group 1 options · one per line"), {target:{value:"i"}});
  expect(screen.queryByLabelText("Group 1 option iv text")).toBeNull();
  fireEvent.click(screen.getByRole("button", {name:"Save corrections & resolutions"}));
  await waitFor(() => expect(vi.mocked(api).mock.calls.filter(([, options]) => options?.method === "PATCH")).toHaveLength(2));
  const last = vi.mocked(api).mock.calls.filter(([, options]) => options?.method === "PATCH")[1];
  expect(JSON.parse(String(last[1]?.body)).candidates[0].content.groups[0].option_labels).toEqual({i:"Shelter"});
});
