import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Link,
  createMemoryRouter,
  RouterProvider,
  Route,
  Routes,
  useLocation,
} from "react-router-dom";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { ReadingAttemptPage, ReadingLibrary } from "../src/features/Reading";
import { api, post } from "../src/services/api";
import { useAuth } from "../src/stores/auth";
vi.mock("../src/services/api", () => ({
  api: vi.fn(),
  post: vi.fn(),
  apiBlob: vi.fn(),
}));
const content = {
  title: "Original passage",
  subtitle: "",
  instructions: "ONE WORD ONLY.",
  paragraphs: [{ label: "A", text: "A roof provides shelter." }],
  groups: [
    {
      title: "Question 6",
      instructions: "ONE WORD ONLY.",
      kind: "short_answer",
      questions: [
        {
          number: 6,
          prompt: "What provides shelter?",
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
const attempt = {
  id: 1,
  paper: 2,
  version: { id: 3, content, published_at: "2026-10-28" },
  book: "Cambridge 10",
  test: 1,
  passage: 1,
  answers: { 6: "old" },
  submitted_at: null,
  score: null,
  total: 1,
};
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}
function Location() {
  const l = useLocation();
  return <div aria-label="Current location">{l.pathname + l.search}</div>;
}
function show(path = "/reading/attempts/1") {
  render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      <RouterProvider
        router={createMemoryRouter(
          [
            {
              path: "*",
              element: (
                <>
                  <Location />
                  <Link to="/reading/attempts/2">Open another attempt</Link>
                  <Routes>
                    <Route
                      path="reading/attempts/:id"
                      element={<ReadingAttemptPage />}
                    />
                    <Route
                      path="reading/full/attempts/:id"
                      element={<ReadingAttemptPage full />}
                    />
                    <Route
                      path="reading/full/attempts/:id/results"
                      element={<ReadingAttemptPage full results />}
                    />
                    <Route path="reading" element={<ReadingLibrary />} />
                    <Route path="library" element={<p>Main Library</p>} />
                  </Routes>
                </>
              ),
            },
          ],
          { initialEntries: [path] },
        )}
      />
    </QueryClientProvider>,
  );
}
beforeEach(() => {
  sessionStorage.clear();
  useAuth.getState().set("test", {
    id: 7,
    username: "Reader",
    email: "",
    role: "student",
    can_edit: false,
  });
});
afterEach(() => {
  cleanup();
  vi.resetAllMocks();
  sessionStorage.clear();
  useAuth.getState().clear();
});
it("walks through published books and tests before offering a passage", async () => {
  vi.mocked(api).mockImplementation(async (path) => path.startsWith("reading-papers/") ? ({
    results: [
      {
        id: 2,
        book: "Cambridge 10",
        test: 1,
        passage: 1,
        title: "Original passage",
        question_count: 13,
        published_version: 3,
      },
      {
        id: 4,
        book: "Cambridge 10",
        test: 2,
        passage: 1,
        title: "Second test passage",
        question_count: 13,
        published_version: 4,
      },
      {
        id: 5,
        book: "Cambridge 11",
        test: 1,
        passage: 1,
        title: "Unpublished passage",
        question_count: 13,
        published_version: null,
      },
    ],
  }) : ({results: [], next: null}) as never);
  show("/reading?collection=Cambridge");
  const book = await screen.findByRole("link", {
    name: /Cambridge 10.*Open tests/,
  }, { timeout: 5000 });
  expect(screen.queryByRole("navigation",{name:"Choose Listening or Reading"})).toBeNull();
  expect(screen.queryByRole("button", { name: "Open / resume" })).toBeNull();
  expect(screen.queryByText("Unpublished passage")).toBeNull();
  fireEvent.click(book);
  fireEvent.click(
    await screen.findByRole("link", { name: /Test 2.*Open passages/ }),
  );
  expect(screen.getByLabelText("Current location")).toHaveTextContent("test=2");
  expect(
    await screen.findByRole("heading", { name: "Second test passage" }),
  ).toBeVisible();
  expect(
    screen.queryByRole("heading", { name: "Original passage" }),
  ).toBeNull();
  vi.mocked(post).mockResolvedValue({ ...attempt, id: 9 });
  const practiceButton = await screen.findByRole("button", { name: "Start Practice" });
  await waitFor(() => expect(practiceButton).toBeEnabled());
  fireEvent.click(practiceButton);
  await waitFor(() =>
    expect(post).toHaveBeenCalledWith("reading-attempts/", { paper: 4 }),
  );
});
it("shows contextual parent links and keeps the learner in place when saving before a breadcrumb exit fails", async () => {
  vi.mocked(api).mockImplementation(async (path, options) => {
    if (options?.method === "PATCH") throw new Error("Save unavailable");
    return attempt as never;
  });
  show();
  await screen.findByLabelText("Question 6");
  const trail = screen.getByRole("navigation", { name: "Reading location" });
  expect(
    within(trail).getByRole("link", { name: "Library", exact: true }),
  ).toHaveAttribute("href", "/library");
  expect(
    within(trail).getByRole("link", { name: "Cambridge Reading" }),
  ).toHaveAttribute("href", "/reading?collection=Cambridge");
  expect(
    within(trail).getByRole("link", { name: "Cambridge 10" }),
  ).toHaveAttribute("href", "/reading?collection=Cambridge&book=Cambridge+10");
  expect(within(trail).getByRole("link", { name: "Test 1" })).toHaveAttribute(
    "href",
    "/reading?collection=Cambridge&book=Cambridge+10&test=1",
  );
  expect(within(trail).getByText("Passage 1")).toHaveAttribute(
    "aria-current",
    "page",
  );
  fireEvent.change(screen.getByLabelText("Question 6"), {
    target: { value: "roof" },
  });
  fireEvent.click(within(trail).getByRole("link", { name: "Test 1" }));
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Save unavailable",
  );
  expect(screen.getByLabelText("Current location")).toHaveTextContent(
    "/reading/attempts/1",
  );
  expect(screen.getByLabelText("Question 6")).toHaveValue("roof");
  expect(sessionStorage.getItem("reading-unsaved:7:1")).toContain("roof");
});
it("ignores an older save response after opening a different attempt", async () => {
  const pending = deferred<typeof attempt>();
  vi.mocked(api).mockImplementation(async (path, options) => {
    if (options?.method === "PATCH") return pending.promise as never;
    return (
      path.includes("/2/")
        ? { ...attempt, id: 2, book: "Another book", answers: { 6: "other" } }
        : attempt
    ) as never;
  });
  show();
  await screen.findByLabelText("Question 6");
  fireEvent.change(screen.getByLabelText("Question 6"), {
    target: { value: "roof" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Save answers" }));
  await waitFor(() =>
    expect(api).toHaveBeenCalledWith(
      "reading-attempts/1/",
      expect.objectContaining({ method: "PATCH" }),
    ),
  );
  fireEvent.click(screen.getByRole("link", { name: "Open another attempt" }));
  await waitFor(() =>
    expect(screen.getByLabelText("Question 6")).toHaveValue("other"),
  );
  await act(async () =>
    pending.resolve({ ...attempt, answers: { 6: "roof" } }),
  );
  expect(screen.getByLabelText("Question 6")).toHaveValue("other");
  expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
    "Another book",
  );
});
it("waits for queued latest answers before submitting and makes submitted fields immutable", async () => {
  const first = deferred<typeof attempt>();
  const second = deferred<typeof attempt>();
  let writes = 0;
  vi.mocked(api).mockImplementation(async (_path, options) => {
    if (options?.method === "PATCH")
      return (++writes === 1 ? first.promise : second.promise) as never;
    return attempt as never;
  });
  vi.mocked(post).mockResolvedValue({
    ...attempt,
    answers: { 6: "roof" },
    submitted_at: "2026-10-28",
    score: 1,
    results: [
      { number: 6, answer: "roof", correct: true, accepted_answers: ["roof"] },
    ],
  });
  show();
  await screen.findByLabelText("Question 6");
  fireEvent.change(screen.getByLabelText("Question 6"), {
    target: { value: "ro" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Save answers" }));
  await waitFor(() => expect(writes).toBe(1));
  fireEvent.change(screen.getByLabelText("Question 6"), {
    target: { value: "roof" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Submit answers" }));
  fireEvent.click(screen.getByRole("button", { name: "Confirm submission" }));
  expect(screen.getByLabelText("Question 6")).toBeDisabled();
  expect(post).not.toHaveBeenCalled();
  await act(async () => first.resolve({ ...attempt, answers: { 6: "ro" } }));
  await waitFor(() => expect(writes).toBe(2));
  expect(screen.getByRole("status")).toHaveTextContent("Saving…");
  expect(api).toHaveBeenLastCalledWith(
    "reading-attempts/1/",
    expect.objectContaining({
      body: JSON.stringify({ answers: { 6: "roof" } }),
    }),
  );
  await act(async () => second.resolve({ ...attempt, answers: { 6: "roof" } }));
  expect(
    await screen.findByRole("heading", { name: "Result: 1 / 1" }),
  ).toBeTruthy();
  expect(post).toHaveBeenCalledWith("reading-attempts/1/submit/");
  expect(screen.getByLabelText("Question 6")).toBeDisabled();
  expect(screen.queryByRole("button", { name: "Save answers" })).toBeNull();
});
it("recovers a learner's unsaved answer without exposing answer keys or confusing it with saved server data", async () => {
  sessionStorage.setItem(
    "reading-unsaved:7:1",
    JSON.stringify({ 6: "roof", 99: "unrelated" }),
  );
  vi.mocked(api).mockImplementation(async (_path, options) =>
    options?.method === "PATCH"
      ? ({ ...attempt, answers: { 6: "roof" } } as never)
      : (attempt as never),
  );
  show();
  expect(await screen.findByLabelText("Question 6")).toHaveValue("roof");
  expect(screen.getByRole("status")).toHaveTextContent("Unsaved changes");
  fireEvent.click(screen.getByRole("button", { name: "Save answers" }));
  await waitFor(() =>
    expect(screen.getByRole("status")).toHaveTextContent(/^Saved$/),
  );
  expect(sessionStorage.getItem("reading-unsaved:7:1")).toBeNull();
  expect(screen.queryByText(/Accepted:/)).toBeNull();
});
it("filters actual published passages by book and test and keeps a clickable location trail", async () => {
  vi.mocked(api).mockImplementation(async (path) => path.startsWith("reading-papers/") ? ({
    results: [
      {
        id: 1,
        book: "Cambridge 10",
        test: 1,
        passage: 1,
        title: "Visible passage",
        question_count: 13,
        published_version: 1,
      },
      {
        id: 2,
        book: "Cambridge 10",
        test: 2,
        passage: 1,
        title: "Other test",
        question_count: 13,
        published_version: 2,
      },
      {
        id: 3,
        book: "Cambridge 11",
        test: 1,
        passage: 1,
        title: "Other book",
        question_count: 13,
        published_version: 3,
      },
    ],
    count: 3,
    next: null,
    previous: null,
  }) : ({results: [], next: null}) as never);
  show("/reading?collection=Cambridge&book=Cambridge+10&test=1");
  expect(
    await screen.findByRole("heading", { name: "Visible passage" }),
  ).toBeTruthy();
  expect(screen.queryByRole("heading", { name: "Other test" })).toBeNull();
  expect(screen.queryByRole("heading", { name: "Other book" })).toBeNull();
  const trail = screen.getByRole("navigation", { name: "Reading location" });
  fireEvent.click(within(trail).getByRole("link", { name: "Cambridge 10" }));
  fireEvent.click(
    await screen.findByRole("link", { name: /Test 2.*Open passages/ }),
  );
  expect(
    await screen.findByRole("heading", { name: "Other test" }),
  ).toBeTruthy();
  expect(screen.queryByRole("heading", { name: "Other book" })).toBeNull();
});

it("includes books from later API pages in the Reading hierarchy", async () => {
  vi.mocked(api).mockImplementation(async (path) =>
    path.includes("page=2")
      ? {
          results: [
            {
              id: 12,
              book: "Cambridge 12",
              test: 1,
              passage: 1,
              title: "Later passage",
              published_version: 12,
              question_count: 13,
            },
          ],
          next: null,
        }
      : {
          results: [
            {
              id: 10,
              book: "Cambridge 10",
              test: 1,
              passage: 1,
              title: "First passage",
              published_version: 10,
              question_count: 13,
            },
          ],
          next: "http://localhost/api/v1/reading-papers/?page=2",
        },
  );
  show("/reading?collection=Cambridge");
  expect(
    await screen.findByRole("link", { name: /Cambridge 12.*Open tests/ }),
  ).toBeVisible();
});

it("starts a complete Full Mock using its timed mode and route", async () => {
  vi.mocked(api).mockImplementation(async (path) => path.startsWith("reading-papers/") ? ({
    results: [
      {
        id: 2,
        book: "Cambridge 10",
        test: 1,
        passage: 1,
        title: "Original",
        question_count: 13,
        published_version: 3,
        full_available: true,
      },
    ],
    next: null,
  }) : ({results: [], next: null}) as never);
  vi.mocked(post).mockResolvedValue({
    ...attempt,
    id: 9,
    passages: [{ passage: 1, version: attempt.version }],
  });
  show("/reading?book=Cambridge+10&test=1");
  const startButton = await screen.findByRole("button", { name: "Start Mock" });
  await waitFor(() => expect(startButton).toBeEnabled());
  fireEvent.click(startButton);
  await waitFor(() =>
    expect(post).toHaveBeenCalledWith("reading-full-attempts/", {
      paper: 2,
      timed: true,
    }),
  );
  await waitFor(() =>
    expect(screen.getByLabelText("Current location")).toHaveTextContent(
      "/reading/full/attempts/9",
    ),
  );
});

it("switches pinned Full passages while keeping and saving answers from every passage", async () => {
  const second = {
    ...content,
    title: "Second original passage",
    groups: [
      {
        ...content.groups[0],
        questions: [{ ...content.groups[0].questions[0], number: 14 }],
      },
    ],
  };
  const fullAttempt = {
    ...attempt,
    total: 40,
    passage: 0,
    timed: false,
    version: {
      ...attempt.version,
      content: { ...content, groups: [...content.groups, ...second.groups] },
    },
    passages: [
      { passage: 1, version: attempt.version },
      { passage: 2, version: { ...attempt.version, id: 4, content: second } },
    ],
  };
  vi.mocked(api).mockImplementation(async (path, options) =>
    options?.method === "PATCH"
      ? { ...fullAttempt, answers: JSON.parse(String(options.body)).answers }
      : fullAttempt,
  );
  show("/reading/full/attempts/1");
  fireEvent.change(await screen.findByLabelText("Question 6"), {
    target: { value: "roof" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Passage 2" }));
  expect(
    screen.getByRole("heading", { name: "Second original passage" }),
  ).toBeVisible();
  fireEvent.change(screen.getByLabelText("Question 14"), {
    target: { value: "shelter" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Passage 1" }));
  expect(screen.getByLabelText("Question 6")).toHaveValue("roof");
  fireEvent.click(screen.getByRole("button", { name: "Save answers" }));
  await waitFor(() =>
    expect(
      vi
        .mocked(api)
        .mock.calls.some(
          ([path, options]) =>
            path === "reading-full-attempts/1/" &&
            options?.method === "PATCH" &&
            JSON.parse(String(options.body)).answers[14] === "shelter",
        ),
    ).toBe(true),
  );
});

it("loads the server's final result when the Full deadline expires", async () => {
  const now = new Date().toISOString();
  const fullAttempt = {
    ...attempt,
    total: 40,
    passage: 0,
    timed: true,
    deadline: new Date(Date.now() - 5000).toISOString(),
    server_time: now,
    passages: [{ passage: 1, version: attempt.version }],
  };
  vi.mocked(api)
    .mockResolvedValueOnce(fullAttempt)
    .mockResolvedValue({
      ...fullAttempt,
      submitted_at: now,
      score: 1,
      results: [],
    });
  show("/reading/full/attempts/1");
  expect(await screen.findByLabelText("Result: 1 / 40")).toBeVisible();
  expect(screen.queryByLabelText("Question 6")).toBeNull();
  expect(screen.queryByRole("button", { name: "Submit Mock" })).toBeNull();
  expect(
    vi
      .mocked(api)
      .mock.calls.every(([, options]) => options?.method !== "PATCH"),
  ).toBe(true);
});

it("saves Full answers before the shared Mock confirmation opens its separate read-only result", async () => {
  const original = {...attempt,total:40,passage:0,timed:false,passages:[{passage:1,version:attempt.version}]};
  const final = {...original,submitted_at:new Date().toISOString(),score:1,answers:{6:"roof"},results:[{number:6,answer:"roof",accepted_answers:["roof"],correct:true}]};
  const saving = deferred<typeof final>();
  let submitted = false;
  vi.spyOn(window,"confirm").mockReturnValue(true);
  vi.mocked(api).mockImplementation(async (_path,options) => options?.method === "PATCH" ? saving.promise : submitted ? final : original);
  vi.mocked(post).mockImplementation(async () => {submitted=true;return final as never;});
  show("/reading/full/attempts/1");
  fireEvent.change(await screen.findByLabelText("Question 6"),{target:{value:"roof"}});
  fireEvent.click(screen.getByRole("button",{name:"Submit Mock"}));
  expect(window.confirm).toHaveBeenCalledWith("Submit this mock? Your answers become read-only and the review will open.");
  expect(post).not.toHaveBeenCalled();
  await act(async () => saving.resolve(final));
  expect(await screen.findByLabelText("Result: 1 / 40")).toBeVisible();
  expect(screen.getByLabelText("Current location")).toHaveTextContent("/reading/full/attempts/1/results");
  expect(screen.queryByLabelText("Question 6")).toBeNull();
  expect(screen.getByText("Your answer: roof")).toBeVisible();
  vi.restoreAllMocks();
});

it("persists pending Full answers before ordinary route navigation", async () => {
  const original = {...attempt,total:40,passage:0,timed:false,passages:[{passage:1,version:attempt.version}]};
  const saving = deferred<typeof original>();
  vi.mocked(api).mockImplementation(async (_path,options) => options?.method === "PATCH" ? saving.promise : original);
  show("/reading/full/attempts/1");
  fireEvent.change(await screen.findByLabelText("Question 6"),{target:{value:"roof"}});
  fireEvent.click(screen.getByRole("link",{name:"Open another attempt"}));
  expect(screen.getByLabelText("Current location")).toHaveTextContent("/reading/full/attempts/1");
  await act(async () => saving.resolve({...original,answers:{6:"roof"}}));
  await waitFor(() => expect(screen.getByLabelText("Current location")).toHaveTextContent("/reading/attempts/2"));
  expect(vi.mocked(api).mock.calls.some(([,options]) => options?.method === "PATCH" && JSON.parse(String(options.body)).answers[6] === "roof")).toBe(true);
});
