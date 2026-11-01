import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, expect, it, vi } from "vitest";
import { PracticeShare } from "../src/features/PracticeShare";
import { SharedPractice } from "../src/features/SharedPractice";
import { type Session, api } from "../src/services/api";
vi.mock("../src/services/api", () => ({ api: vi.fn(), post: vi.fn() }));
afterEach(() => {
  cleanup();
  vi.resetAllMocks();
  vi.unstubAllGlobals();
});
function show(element: React.ReactNode) {
  render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      <MemoryRouter initialEntries={["/shared/practice/example"]}>
        <Routes>
          <Route path="shared/practice/:token" element={element} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}
const session = {
  id: 4,
  title: "Test 1 · Part 1",
  difficulty: "medium",
  groups: [{}, {}],
  checked_positions: [0, 1],
} as Session;
it("shares exactly the completed session and can revoke its link", async () => {
  vi.mocked(api).mockResolvedValue({ token: null });
  const write = vi
    .fn()
    .mockResolvedValueOnce({ token: "part-one-medium" })
    .mockResolvedValueOnce({ token: null });
  show(<PracticeShare session={session} writeShare={write} />);
  const button = await screen.findByRole("button", {
    name: "Create live practice link",
  });
  await waitFor(() => expect(button).toBeEnabled());
  fireEvent.click(button);
  expect(await screen.findByLabelText("Public practice link")).toHaveValue(
    `${window.location.origin}/shared/practice/part-one-medium`,
  );
  expect(api).toHaveBeenCalledWith("sessions/4/share/");
  expect(write).toHaveBeenCalledWith(false);
  fireEvent.click(screen.getByRole("button", { name: "Stop sharing" }));
  expect(
    await screen.findByRole("button", { name: "Create live practice link" }),
  ).toBeTruthy();
  expect(write).toHaveBeenCalledWith(true);
});
it("creates a live link before the first checked answer", async () => {
  vi.mocked(api).mockResolvedValue({ token: null });
  const write = vi.fn().mockResolvedValue({ token: "live-start" });
  show(
    <PracticeShare
      session={{ ...session, checked_positions: [] }}
      writeShare={write}
    />,
  );
  const button = await screen.findByRole("button", {
    name: "Create live practice link",
  });
  await waitFor(() => expect(button).toBeEnabled());
  expect(screen.getByText("PRACTICE IN PROGRESS")).toBeTruthy();
  fireEvent.click(button);
  expect(await screen.findByLabelText("Public practice link")).toHaveValue(
    `${window.location.origin}/shared/practice/live-start`,
  );
});
it("explains a shared Medium Part 1 dictation and shows checked answers without login", async () => {
  const fetcher = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({
      title: "Test 1 · Part 1",
      category_path: ["Book", "Volume 1"],
      test_title: "Test 1",
      part_label: "Part 1",
      difficulty: "medium",
      exercise_count: 1,
      checked_count: 1,
      status: "completed",
      accuracy: 50,
      completed_at: "2026-10-27T10:00:00Z",
      results: [
        {
          number: 1,
          answer: "I heard park",
          reference: "I heard station",
          accuracy: 50,
          tokens: [],
          attempt_count: 1,
          first_accuracy: 50,
          attempts: [
            {
              number: 1,
              accuracy: 50,
              mistakes: [
                { status: "incorrect", actual: "park", expected: "station" },
              ],
            },
          ],
        },
      ],
    }),
  });
  vi.stubGlobal("fetch", fetcher);
  show(<SharedPractice />);
  expect(
    await screen.findByText("Test 1 · Part 1 · Medium dictation"),
  ).toBeTruthy();
  expect(
    screen.getByText(
      "The learner listened to one sentence at a time and typed what they heard.",
    ),
  ).toBeTruthy();
  expect(screen.getByText("park")).not.toBeVisible();
  fireEvent.click(screen.getByText("Batafsil"));
  expect(screen.getByText("park")).not.toBeVisible();
  fireEvent.click(screen.getByText("Mistakes by attempt"));
  expect(screen.getByText("park")).toBeVisible();
  expect(screen.getByText("station")).toBeVisible();
  expect(screen.queryByText(/I heard park/)).toBeNull();
  expect(screen.queryByText(/I heard station/)).toBeNull();
  expect(fetcher).toHaveBeenCalledWith(
    "/api/v1/shared-practice-results/example/",
    { credentials: "omit", referrerPolicy: "no-referrer" },
  );
});

it.each(["easy", "medium", "hard", "full"])(
  "offers an independent link for completed %s practice",
  async (difficulty) => {
    vi.mocked(api).mockResolvedValue({ token: `${difficulty}-only` });
    show(
      <PracticeShare
        session={{ ...session, difficulty } as Session}
        writeShare={vi.fn()}
      />,
    );
    expect(await screen.findByLabelText("Public practice link")).toHaveValue(
      `${window.location.origin}/shared/practice/${difficulty}-only`,
    );
    expect(
      screen.getByText(/Each Part and difficulty has its own link/),
    ).toBeTruthy();
  },
);
it("shows a useful message for a revoked public link", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 404 }));
  show(<SharedPractice />);
  expect(
    await screen.findByText(
      "This practice link is unavailable or has been removed.",
    ),
  ).toBeTruthy();
});

it("refreshes the same public link from in progress to completed", async () => {
  const common = {
    title: "Live exercise",
    category_path: [],
    test_title: "Test 1",
    part_label: "Part 1",
    difficulty: "easy",
    exercise_count: 1,
    results: [],
  };
  const fetcher = vi
    .fn()
    .mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        ...common,
        status: "in_progress",
        checked_count: 0,
        accuracy: null,
        completed_at: null,
      }),
    })
    .mockResolvedValue({
      ok: true,
      json: async () => ({
        ...common,
        status: "completed",
        checked_count: 1,
        accuracy: 100,
        completed_at: "2026-10-27T10:00:00Z",
      }),
    });
  vi.stubGlobal("fetch", fetcher);
  show(<SharedPractice />);
  expect(await screen.findByText("No checked answers yet")).toBeTruthy();
  expect(screen.getByRole("status")).toHaveTextContent("In progress");
  fireEvent.click(screen.getByRole("button", { name: "Refresh progress" }));
  expect(await screen.findByText("100% accuracy")).toBeTruthy();
  expect(screen.getByRole("status")).toHaveTextContent("Completed");
  expect(screen.queryByText("No checked answers yet")).toBeNull();
  expect(fetcher).toHaveBeenCalledTimes(2);
});

it("shows real retry counts and first/latest accuracy with ten answers per page", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        title: "Retry practice",
        category_path: [],
        test_title: "",
        part_label: "",
        difficulty: "easy",
        exercise_count: 11,
        checked_count: 11,
        status: "completed",
        accuracy: 100,
        completed_at: null,
        results: Array.from({ length: 11 }, (_, i) => ({
          number: i + 1,
          answer: `Answer ${i + 1}`,
          reference: "Reference",
          accuracy: 100,
          tokens: [],
          attempt_count: i === 10 ? 3 : 1,
          first_accuracy: i === 10 ? 20 : 100,
          attempts:
            i === 10
              ? [
                  {
                    number: 1,
                    accuracy: 20,
                    mistakes: [
                      {
                        status: "incorrect",
                        actual: "park",
                        expected: "station",
                      },
                      { status: "missing", actual: "", expected: "the" },
                      { status: "extra", actual: "extra", expected: "" },
                    ],
                  },
                  { number: 2, accuracy: 50, mistakes: [] },
                  { number: 3, accuracy: 100, mistakes: [] },
                ]
              : [
                  {
                    number: 1,
                    accuracy: 100,
                    mistakes: [
                      { status: "incorrect", actual: "one", expected: "two" },
                      { status: "missing", actual: "", expected: "three" },
                      { status: "extra", actual: "four", expected: "" },
                    ],
                  },
                ],
        })),
      }),
    }),
  );
  show(<SharedPractice />);
  await screen.findByText("Batafsil");
  expect(screen.getByText("Exercise 1", { exact: true })).not.toBeVisible();
  fireEvent.click(screen.getByText("Batafsil"));
  expect(
    screen.getByRole("heading", { name: "Exercise 1", exact: true }),
  ).toBeTruthy();
  expect(
    screen.queryByRole("heading", { name: "Exercise 11", exact: true }),
  ).toBeNull();
  expect(screen.getByRole("button", { name: "Previous" })).toBeDisabled();
  fireEvent.click(screen.getByRole("button", { name: "Next" }));
  expect(
    screen.getByText("3 attempts · First: 20% → Latest: 100%"),
  ).toBeTruthy();
  expect(screen.getByText("Page 2 of 2")).toBeTruthy();
  expect(screen.getByText("park")).not.toBeVisible();
  fireEvent.click(screen.getByText("Mistakes by attempt"));
  expect(screen.getByText("park").tagName).toBe("DEL");
  expect(screen.getByText("station")).toBeVisible();
  expect(screen.getByText("Missing word")).toBeVisible();
  expect(screen.getByText("Extra word")).toBeVisible();
  expect(screen.getByText("Attempt 3")).toBeVisible();
  expect(
    screen.queryByRole("heading", { name: "Exercise 1", exact: true }),
  ).toBeNull();
  expect(screen.getByRole("button", { name: "Next" })).toBeDisabled();
  fireEvent.click(screen.getByRole("button", { name: "Previous" }));
  expect(
    screen.getByRole("heading", { name: "Exercise 1", exact: true }),
  ).toBeTruthy();
});

it("prioritizes cumulative mistakes across all attempts, including corrected exercises", async () => {
  const mistake = { status: "incorrect", actual: "park", expected: "station" };
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        title: "Teacher review",
        category_path: [],
        test_title: "Test 1",
        part_label: "Part 1",
        difficulty: "medium",
        exercise_count: 12,
        checked_count: 12,
        status: "completed",
        accuracy: 90,
        completed_at: null,
        results: Array.from({ length: 12 }, (_, i) => ({
          number: i + 1,
          answer: "",
          reference: "",
          tokens: [],
          accuracy: i === 10 ? 60 : i === 11 ? 80 : 100,
          attempt_count: 2,
          first_accuracy: 0,
          attempts: [
            {
              number: 1,
              accuracy: 0,
              mistakes: Array(i === 9 ? 10 : i === 10 ? 2 : 0).fill(mistake),
            },
            {
              number: 2,
              accuracy: i === 10 ? 60 : i === 11 ? 80 : 100,
              mistakes: Array(i === 10 ? 2 : i === 11 ? 3 : 0).fill(mistake),
            },
          ],
        })),
      }),
    }),
  );
  show(<SharedPractice />);
  await screen.findByText("Batafsil");
  fireEvent.click(screen.getByText("Batafsil"));
  const exerciseHeadings = () =>
    screen
      .getAllByRole("heading", { name: /^Exercise / })
      .map((el) => el.textContent);
  expect(exerciseHeadings()).toEqual([
    "Exercise 10",
    "Exercise 11",
    "Exercise 12",
    ...Array.from({ length: 7 }, (_, i) => `Exercise ${i + 1}`),
  ]);
  expect(screen.getByText("Total mistakes: 10 · All attempts")).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "Next" }));
  expect(exerciseHeadings()).toEqual(["Exercise 8", "Exercise 9"]);
  fireEvent.click(screen.getByRole("button", { name: "Previous" }));
  expect(exerciseHeadings()[0]).toBe("Exercise 10");
});
