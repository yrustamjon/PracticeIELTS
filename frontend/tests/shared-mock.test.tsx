import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, expect, it, vi } from "vitest";
import { MockShareLink, SharedMock } from "../src/features/SharedMock";
vi.mock("../src/services/api", () => ({ api: vi.fn(), post: vi.fn() }));
import { api, post } from "../src/services/api";
afterEach(() => { cleanup(); vi.resetAllMocks(); vi.unstubAllGlobals(); });
function wrap(element: React.ReactNode) {
  return render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><MemoryRouter initialEntries={["/shared/mock/example"]}><Routes><Route path="shared/mock/:token" element={element} /></Routes></MemoryRouter></QueryClientProvider>);
}
it("opens detailed results without credentials", async () => {
  const fetcher = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ title: "Original test", category_path: ["Book", "Volume"], test_title: "Test 1", part_label: "Part 2", score: 0, total: 1, timing: "untimed", submitted_at: "2026-10-27T10:00:00Z", results: [{ number: 11, part: 2, prompt: "Destination", correct: false, answer: "park", accepted_answers: ["station"], options: [] }] }) });
  vi.stubGlobal("fetch", fetcher);
  wrap(<SharedMock />);
  expect(await screen.findByText("Original test")).toBeTruthy();
  expect(screen.getByText("Book → Volume")).toBeTruthy();
  expect(screen.getByText("Your answer: park")).toBeTruthy();
  expect(screen.getByText("Correct answer: station")).toBeTruthy();
  expect(screen.getByText("Incorrect")).toBeTruthy();
  expect(fetcher).toHaveBeenCalledWith("/api/v1/shared-results/example/", { credentials: "omit", referrerPolicy: "no-referrer" });
});
it("explains removed public links", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 404 }));
  wrap(<SharedMock />);
  expect(await screen.findByText(/This result link is unavailable/)).toBeTruthy();
});
it("creates a public link and revokes it", async () => {
  vi.mocked(api).mockResolvedValue({ token: null });
  vi.mocked(post).mockResolvedValue({ token: "public-token" });
  wrap(<MockShareLink attemptId={4} />);
  fireEvent.click(await screen.findByRole("button", { name: "Create public result link" }));
  expect(await screen.findByLabelText("Public result link")).toHaveValue(`${window.location.origin}/shared/mock/public-token`);
  expect(post).toHaveBeenCalledWith("mock-attempts/4/share/");
  fireEvent.click(screen.getByRole("button", { name: "Stop sharing" }));
  expect(await screen.findByRole("button", { name: "Create public result link" })).toBeTruthy();
  expect(api).toHaveBeenCalledWith("mock-attempts/4/share/", { method: "DELETE" });
});
