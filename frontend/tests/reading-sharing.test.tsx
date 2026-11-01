import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, expect, it, vi } from "vitest";
import { ReadingShareLink, SharedReadingResult } from "../src/features/ReadingSharing";
import { api, post } from "../src/services/api";
vi.mock("../src/services/api", () => ({ api: vi.fn(), post: vi.fn() }));
afterEach(() => { cleanup(); vi.resetAllMocks(); vi.unstubAllGlobals(); });
function show(full = false, publicPage = false) {
  return render(<QueryClientProvider client={new QueryClient({defaultOptions:{queries:{retry:false}}})}><MemoryRouter initialEntries={["/shared/reading/private-token"]}><Routes><Route path="/shared/reading/:token" element={publicPage ? <SharedReadingResult /> : <ReadingShareLink attemptId={7} full={full} />} /></Routes></MemoryRouter></QueryClientProvider>);
}
it.each([false, true])("creates and revokes the correct Reading result resource, full=%s", async full => {
  vi.mocked(api).mockResolvedValue({token:null});vi.mocked(post).mockResolvedValue({token:"result-token"});show(full);
  fireEvent.click(await screen.findByRole("button", {name:"Create public result link"}));
  await waitFor(() => expect(post).toHaveBeenCalledWith(`${full ? "reading-full-attempts" : "reading-attempts"}/7/share/`));
  expect(await screen.findByLabelText("Public result link")).toHaveValue(`${window.location.origin}/shared/reading/result-token`);
  fireEvent.click(screen.getByRole("button", {name:"Stop sharing"}));
  await waitFor(() => expect(api).toHaveBeenCalledWith(`${full ? "reading-full-attempts" : "reading-attempts"}/7/share/`, {method:"DELETE"}));
  expect(await screen.findByRole("button", {name:"Create public result link"})).toBeVisible();
});
it("loads a public passage result without sending credentials", async () => {
  const fetcher=vi.fn().mockResolvedValue({ok:true,json:async()=>({book:"Original 1",test:2,passage:1,title:"Original passage",timed:false,score:1,total:1,submitted_at:"2026-10-29T12:00:00Z",results:[{number:1,passage:1,prompt:"What covers the house?",answer:"roof",correct:true,accepted_answers:["roof"],options:[]}]})});
  vi.stubGlobal("fetch",fetcher);show(false,true);
  expect(await screen.findByLabelText("Result: 1 / 1")).toBeVisible();
  expect(screen.getByText("Original 1 · Test 2 · Passage 1")).toBeVisible();
  expect(fetcher).toHaveBeenCalledWith("/api/v1/shared-reading-results/private-token/",{credentials:"omit",referrerPolicy:"no-referrer"});
});
it("explains that a revoked public Reading link is unavailable", async () => {
  vi.stubGlobal("fetch",vi.fn().mockResolvedValue({ok:false,status:404}));show(false,true);
  expect(await screen.findByText("This result link is unavailable or has been removed.")).toBeVisible();
});
