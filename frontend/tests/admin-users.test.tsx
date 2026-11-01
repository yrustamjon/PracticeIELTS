import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { afterEach, expect, it, vi } from "vitest";
import { AdminUsers } from "../src/features/AdminUsers";
import { useAuth } from "../src/stores/auth";
vi.mock("../src/services/api", () => ({ api: vi.fn() }));
import { api } from "../src/services/api";
afterEach(() => {
  cleanup();
  vi.resetAllMocks();
  useAuth.getState().clear();
});
function show(allowed = true) {
  useAuth
    .getState()
    .set("test", {
      id: 1,
      username: "admin",
      email: "",
      role: "admin",
      can_edit: true,
      can_view_users: allowed,
    });
  render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      <MemoryRouter>
        <AdminUsers />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}
const overview = {
  total_users: 12,
  students: 10,
  active_accounts: 11,
  learning_users_7d: 3,
  completed_mocks: 7,
  checked_answers: 50,
  mock_score_percent: 65,
};
const user = {
  id: 2,
  username: "learner",
  email: "learner@example.test",
  role: "student",
  is_active: true,
  is_superuser: false,
  date_joined: "2026-10-01T10:00:00Z",
  practice_sessions: 2,
  checked_answers: 6,
  completed_mocks: 2,
  mock_score_percent: 70,
  last_learning_at: null,
};
it("shows real counts and searches the paginated directory", async () => {
  vi.mocked(api).mockImplementation(async (path) =>
    path === "admin/users/overview/"
      ? overview
      : { count: 1, results: [user], next: null, previous: null },
  );
  show();
  expect(await screen.findByText("learner@example.test")).toBeTruthy();
  expect(screen.getByText("70%")).toBeTruthy();
  fireEvent.change(screen.getByRole("textbox", { name: "Search users" }), {
    target: { value: "learner" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Search", exact: true }));
  await screen.findByText("learner@example.test");
  expect(api).toHaveBeenCalledWith("admin/users/?page=1&search=learner&role=");
});
it("hides directory from teachers without requesting data", () => {
  show(false);
  expect(screen.getByText("Administrators only")).toBeTruthy();
  expect(api).not.toHaveBeenCalled();
});
it("shows empty state without inventing learning scores", async () => {
  vi.mocked(api).mockImplementation(async (path) =>
    path === "admin/users/overview/"
      ? { ...overview, mock_score_percent: null }
      : { count: 0, results: [], next: null, previous: null },
  );
  show();
  expect(await screen.findByText("No users found")).toBeTruthy();
  expect(screen.getByText("No scored attempts yet")).toBeTruthy();
});
