import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, expect, it, vi } from "vitest";
import { ReadingReview } from "../src/features/Reading";
import { api } from "../src/services/api";
import { useAuth } from "../src/stores/auth";
vi.mock("../src/services/api", () => ({
  api: vi.fn(),
  apiBlob: vi.fn(),
  post: vi.fn(),
}));
afterEach(() => {
  cleanup();
  vi.resetAllMocks();
  useAuth.getState().clear();
});
it("uses book and test cards in admin and keeps that location when adding source material", async () => {
  useAuth.getState().set("test", {
    id: 1,
    username: "Editor",
    email: "",
    role: "teacher",
    can_edit: true,
  });
  vi.mocked(api).mockImplementation(
    async (path) =>
      ({
        results: path.startsWith("reading-papers")
          ? [
              {
                id: 2,
                book: "Cambridge 10",
                test: 2,
                passage: 1,
                title: "Reviewed passage",
                published_version: 3,
                can_edit: true,
                question_count: 13,
                full_available: true,
              },
            ]
          : [
              {
                id: 7,
                book: "Cambridge 10",
                source_name: "source.pdf",
                state: "needs_review",
                candidates: [],
              },
            ],
        next: null,
        count: 1,
        previous: null,
      }) as never,
  );
  render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      <MemoryRouter initialEntries={["/admin/reading"]}>
        <Routes>
          <Route path="/admin/reading" element={<ReadingReview />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
  fireEvent.click(
    await screen.findByRole("link", { name: /Cambridge Reading.*Open books/ }, {timeout:5000}),
  );
  fireEvent.click(
    await screen.findByRole("link", { name: /Cambridge 10.*Open tests/ }),
  );
  fireEvent.click(
    await screen.findByRole("link", { name: /Test 2.*Open passages/ }),
  );
  expect(
    await screen.findByRole("link", { name: /Passage 1.*Reviewed passage/ }),
  ).toHaveAttribute("href", "/admin/reading/2");
  expect(
    screen.getByRole("link", { name: "Add passage from PDF" }),
  ).toHaveAttribute("href", "/admin/reading/import?book=Cambridge+10&test=2");
  expect(screen.getByRole("link",{name:"Preview Mock"})).toHaveAttribute("href","/reading?collection=Cambridge&book=Cambridge%2010&test=2");
  expect(screen.queryByRole("navigation",{name:"Choose Listening or Reading"})).toBeNull();
  expect(screen.getByRole("link", { name: /source.pdf/ })).toHaveAttribute(
    "href",
    "/admin/reading/imports/7?book=Cambridge+10&test=2",
  );
});
it("does not fetch private reading data for students", () => {
  useAuth.getState().set("test", {
    id: 1,
    username: "Student",
    email: "",
    role: "student",
    can_edit: false,
  });
  render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter>
        <ReadingReview />
      </MemoryRouter>
    </QueryClientProvider>,
  );
  expect(screen.getByRole("alert")).toHaveTextContent("Editor access required");
  expect(api).not.toHaveBeenCalled();
});

it("keeps saved unpublished tests visible and opens their source draft", async () => {
  useAuth
    .getState()
    .set("test", {
      id: 1,
      username: "Editor",
      email: "",
      role: "teacher",
      can_edit: true,
    });
  vi.mocked(api).mockImplementation(
    async (path) =>
      ({
        results: path.startsWith("reading-papers")
          ? []
          : [
              {
                id: 7,
                book: "Cambridge 10",
                source_name: "source.pdf",
                state: "needs_review",
                published_papers: [],
                locations: [
                  {
                    candidate_index: 0,
                    book: "Cambridge 10",
                    test: 2,
                    passage: 1,
                    title: "Saved draft",
                  },
                ],
              },
            ],
        next: null,
        count: 1,
        previous: null,
      }) as never,
  );
  render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      <MemoryRouter initialEntries={["/admin/reading?book=Cambridge+10"]}>
        <Routes>
          <Route path="/admin/reading" element={<ReadingReview />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
  fireEvent.click(
    await screen.findByRole("link", { name: /Test 2.*Open passages/ }),
  );
  expect(
    await screen.findByRole("link", { name: /Passage 1.*Saved draft/ }),
  ).toHaveAttribute(
    "href",
    "/admin/reading/imports/7?book=Cambridge+10&test=2&candidate=0",
  );
});
