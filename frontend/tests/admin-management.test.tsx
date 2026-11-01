import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { SuperAdminSettings } from "../src/features/AccountSettings";
vi.mock("../src/services/api", () => ({ api: vi.fn(), post: vi.fn() }));
import { api, post } from "../src/services/api";
const admin = {
  id: 2,
  username: "editor",
  email: "editor@example.test",
  is_superuser: false,
  is_active: true,
  date_joined: "2026-01-01T00:00:00Z",
};
beforeEach(() => {
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close = function () {
    this.removeAttribute("open");
    this.dispatchEvent(new Event("close"));
  };
  vi.mocked(api).mockImplementation(async (path) =>
    path.startsWith("admin/accounts/?")
      ? { results: [admin], next: null, previous: null, count: 1 }
      : path.startsWith("admin/activity/")
        ? { results: [], next: null, previous: null, count: 0 }
        : admin,
  );
});
afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});
function show(url = "/admin/management") {
  render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      <MemoryRouter initialEntries={[url]}>
        <SuperAdminSettings />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}
it("shows only list and add button; opens creation fields in a dialog", async () => {
  show();
  expect(
    await screen.findByRole("link", { name: "Open profile for editor" }),
  ).toHaveAttribute("href", "/admin/management?administrator=2");
  expect(screen.queryByRole("textbox", { name: "Admin username" })).toBeNull();
  expect(screen.queryByText("Admin activity")).toBeNull();
  expect(
    vi
      .mocked(api)
      .mock.calls.some(([path]) => path.startsWith("admin/activity/")),
  ).toBe(false);
  fireEvent.click(screen.getByRole("button", { name: "Add administrator" }));
  expect(
    screen.getByRole("dialog", { name: "Add administrator" }),
  ).toBeTruthy();
  fireEvent.change(screen.getByLabelText("Admin username"), {
    target: { value: "new-editor" },
  });
  fireEvent.change(screen.getByLabelText("Initial password"), {
    target: { value: "Unique-study-739!" },
  });
  fireEvent.submit(screen.getByLabelText("Admin username").closest("form")!);
  await waitFor(() =>
    expect(post).toHaveBeenCalledWith(
      "admin/accounts/",
      expect.objectContaining({ username: "new-editor" }),
    ),
  );
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
});
it("opens a refreshable profile with scoped logs, password reset and block controls", async () => {
  show("/admin/management?administrator=2");
  expect(await screen.findByRole("heading", { name: "editor" })).toBeTruthy();
  expect(await screen.findByText("No activity found")).toBeTruthy();
  expect(api).toHaveBeenCalledWith(expect.stringContaining("account=2"));
  fireEvent.click(screen.getByRole("button", { name: "Block administrator" }));
  await waitFor(() =>
    expect(api).toHaveBeenCalledWith("admin/accounts/2/", {
      method: "PATCH",
      body: JSON.stringify({ is_active: false }),
    }),
  );
  await screen.findByText("Administrator blocked.");
  expect(screen.queryByRole("dialog", { name: "Change password" })).toBeNull();
  fireEvent.click(
    screen.getByRole("button", { name: "Change password", exact: true }),
  );
  expect(screen.getByRole("dialog", { name: "Change password" })).toBeTruthy();
  fireEvent.change(screen.getByLabelText("New password"), {
    target: { value: "Revised-study-841!" },
  });
  fireEvent.change(screen.getByLabelText("Confirm new password"), {
    target: { value: "Revised-study-841!" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Save password" }));
  await waitFor(() =>
    expect(api).toHaveBeenCalledWith("admin/accounts/2/", {
      method: "PATCH",
      body: JSON.stringify({ new_password: "Revised-study-841!" }),
    }),
  );
});
it("shows profile lookup errors without showing account controls", async () => {
  vi.mocked(api).mockRejectedValue(new Error("Account not found"));
  show("/admin/management?administrator=999");
  expect(await screen.findByText(/Account not found/)).toBeTruthy();
  expect(
    screen.queryByRole("button", { name: "Block administrator" }),
  ).toBeNull();
});

it("cancels the password dialog without changing the account", async () => {
  show("/admin/management?administrator=2");
  await screen.findByRole("heading", { name: "editor" });
  expect(screen.queryByRole("dialog", { name: "Change password" })).toBeNull();
  fireEvent.click(
    screen.getByRole("button", { name: "Change password", exact: true }),
  );
  fireEvent.change(screen.getByLabelText("New password"), {
    target: { value: "Draft-secret-473!" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Cancel", exact: true }));
  expect(screen.queryByRole("dialog", { name: "Change password" })).toBeNull();
  expect(
    vi
      .mocked(api)
      .mock.calls.some(([, options]) => options?.method === "PATCH"),
  ).toBe(false);
  expect(
    screen.getByRole("button", { name: "Change password", exact: true }),
  ).toHaveFocus();
});
