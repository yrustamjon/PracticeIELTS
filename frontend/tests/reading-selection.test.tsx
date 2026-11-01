import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, expect, it, vi } from "vitest";
import { cleanup } from "@testing-library/react";
import {
  ReadingHistory,
  ReadingTestSelection,
} from "../src/features/ReadingSelection";
import { api, post } from "../src/services/api";
vi.mock("../src/services/api", () => ({ api: vi.fn(), post: vi.fn() }));
const papers = [1, 2, 3].map((n) => ({
  id: n,
  passage: n,
  title: `Passage title ${n}`,
  question_count: n === 3 ? 14 : 13,
  full_available: true,
}));
const active = {
  id: 9,
  paper: 1,
  book: "Original 1",
  test: 1,
  passage: 0,
  title: "Full Reading Mock",
  timed: false,
  submitted_at: null,
  score: null,
  total: 40,
};
function mockRecords(full = [active], passages: unknown[] = []) {
  vi.mocked(api).mockImplementation(
    async (path) =>
      ({
        results: path.startsWith("reading-full") ? full : passages,
        next: null,
      }) as never,
  );
}
function show(history = false) {
  return render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      <MemoryRouter initialEntries={["/reading?book=Original+1&test=1"]}>
        <Routes>
          <Route
            path="/reading"
            element={
              history ? (
                <ReadingHistory />
              ) : (
                <ReadingTestSelection
                  papers={papers}
                  book="Original 1"
                  test="1"
                />
              )
            }
          />
          <Route
            path="/reading/full/attempts/:id"
            element={<p>Full workspace</p>}
          />
          <Route
            path="/reading/attempts/:id"
            element={<p>Passage workspace</p>}
          />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.resetAllMocks();
});
it("keeps the current attempt when a timing change is cancelled", async () => {
  mockRecords();
  vi.spyOn(window, "confirm").mockReturnValue(false);
  show();
  await screen.findByRole("button", { name: "Resume Mock" }, { timeout: 5000 });
  fireEvent.click(screen.getByRole("radio", { name: /Real Exam · Timed/ }));
  fireEvent.click(screen.getByRole("button", { name: "Start Mock" }));
  expect(await screen.findByText("Full workspace")).toBeVisible();
  expect(post).not.toHaveBeenCalled();
});
it("keeps a failed mode change visible without starting another attempt", async () => {
  mockRecords();
  vi.spyOn(window, "confirm").mockReturnValue(true);
  vi.mocked(post).mockRejectedValue(new Error("Submission unavailable"));
  show();
  await screen.findByRole("button", { name: "Resume Mock" }, { timeout: 5000 });
  fireEvent.click(screen.getByRole("radio", { name: /Real Exam · Timed/ }));
  fireEvent.click(screen.getByRole("button", { name: "Start Mock" }));
  expect(await screen.findByText("Submission unavailable")).toBeVisible();
  expect(post).toHaveBeenCalledTimes(1);
  expect(post).toHaveBeenCalledWith("reading-full-attempts/9/submit/", {});
  expect(
    screen.getByRole("link", { name: /Resume active untimed mock/ }),
  ).toBeVisible();
});
it("restores the existing timing and resumes the owned full mock", async () => {
  mockRecords();
  vi.mocked(post).mockResolvedValue({ id: 9 });
  show();
  fireEvent.click(
    await screen.findByRole(
      "button",
      { name: "Resume Mock" },
      { timeout: 5000 },
    ),
  );
  await waitFor(() =>
    expect(post).toHaveBeenCalledWith("reading-full-attempts/", {
      paper: 1,
      timed: false,
    }),
  );
  expect(await screen.findByText("Full workspace")).toBeVisible();
});
it("does not resume another publication with the same book and test name", async () => {
  mockRecords([{ ...active, paper: 99 }]);
  show();
  const button = await screen.findByRole("button", { name: "Start Mock" });
  await waitFor(() => expect(button).toBeEnabled());
  expect(screen.queryByRole("link", { name: /Resume active/ })).toBeNull();
});
it("selects one passage without starting a full test", async () => {
  mockRecords([]);
  vi.mocked(post).mockResolvedValue({ id: 10 });
  show();
  fireEvent.click(
    screen.getByRole("button", { name: /Passage 2.*13 questions/ }),
  );
  const button = await screen.findByRole("button", { name: "Start Practice" });
  await waitFor(() => expect(button).toBeEnabled());
  fireEvent.click(button);
  await waitFor(() =>
    expect(post).toHaveBeenCalledWith("reading-attempts/", { paper: 2 }),
  );
  expect(await screen.findByText("Passage workspace")).toBeVisible();
});
it("blocks passage practice during an active timed mock", async () => {
  mockRecords([{ ...active, timed: true }]);
  show();
  await screen.findByRole("button", { name: "Resume Mock" }, { timeout: 5000 });
  fireEvent.click(
    screen.getByRole("button", { name: /Passage 1.*13 questions/ }),
  );
  expect(screen.getByRole("button", { name: "Start Practice" })).toBeDisabled();
  expect(
    screen.getByRole("link", { name: /Resume active timed mock/ }),
  ).toHaveAttribute("href", "/reading/full/attempts/9");
  expect(post).not.toHaveBeenCalled();
});
it("shows persisted full and passage scores with distinct result routes", async () => {
  const done = { ...active, submitted_at: "2026-10-29T10:00:00Z", score: 32 };
  mockRecords([done], [{ ...done, id: 5, passage: 2, total: 13, score: 10 }]);
  show(true);
  expect(await screen.findByText("32 / 40")).toBeVisible();
  expect(
    screen.getByRole("link", { name: /Full Reading Mock.*32 \/ 40/ }),
  ).toHaveAttribute("href", "/reading/full/attempts/9/results");
  expect(
    screen.getByRole("link", { name: /Passage 2.*10 \/ 13/ }),
  ).toHaveAttribute("href", "/reading/attempts/5");
});
it("does not start an attempt when resume history cannot be loaded", async () => {
  vi.mocked(api).mockRejectedValue(new Error("History unavailable"));
  show();
  await screen.findAllByText("History unavailable");
  expect(screen.getByRole("button", { name: "Start Mock" })).toBeDisabled();
  expect(post).not.toHaveBeenCalled();
});
