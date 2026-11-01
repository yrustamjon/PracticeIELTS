import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { afterEach, expect, it, vi } from "vitest";
import { MockHistory } from "../src/features/MockHistory";
vi.mock("../src/services/api", () => ({ api: vi.fn() }));
import { api } from "../src/services/api";
afterEach(() => { cleanup(); vi.resetAllMocks(); });
function show() { render(<QueryClientProvider client={new QueryClient({defaultOptions:{queries:{retry:false}}})}><MemoryRouter><MockHistory /></MemoryRouter></QueryClientProvider>); }
const row = {id: 31, title: "Original book — Test 1 — Part 2", category_name: "Volume 1", timing: "untimed", submitted_at: "2026-10-27T10:00:00Z", score: 7, total: 10};
it("shows saved scores and links directly to results with pagination", async () => {
  vi.mocked(api).mockResolvedValueOnce({count:11,results:[row],next:"page2",previous:null}).mockResolvedValueOnce({count:11,results:[{...row,id:32,title:"Older result"}],next:null,previous:"page1"});
  show();
  const link = await screen.findByRole("link", {name:/Original book/}, {timeout:5000});
  expect(link).toHaveAttribute("href", "/mock/31/results");
  expect(screen.getByText("7 / 10")).toBeTruthy();
  expect(screen.getByText("70% correct")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", {name:"Next"}));
  expect((await screen.findByText("Older result")).closest("a")).toHaveAttribute("href", "/mock/32/results?history_page=2");
  expect(api).toHaveBeenCalledWith("mock-attempts/history/?page=2");
});
it("shows an honest empty state", async () => {
  vi.mocked(api).mockResolvedValue({count:0,results:[],next:null,previous:null});
  show();
  expect(await screen.findByText("No completed mocks yet")).toBeTruthy();
});
it("shows errors and lets the learner retry", async () => {
  vi.mocked(api).mockRejectedValueOnce(new Error("History unavailable")).mockResolvedValueOnce({count:0,results:[],next:null,previous:null});
  show();
  expect(await screen.findByText("History unavailable")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", {name:"Try again"}));
  expect(await screen.findByText("No completed mocks yet")).toBeTruthy();
});
