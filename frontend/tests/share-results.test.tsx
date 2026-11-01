import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { ShareResults } from "../src/components/ShareResults";

afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });
const text = "PracticeIELTS — Listening Mock\nOriginal test\nScore: 7 / 10 (70% correct)";
function setup(share?: ReturnType<typeof vi.fn>, writeText?: ReturnType<typeof vi.fn>) {
  vi.stubGlobal("navigator", { share, clipboard: writeText ? { writeText } : undefined });
  render(<ShareResults text={text} />);
  fireEvent.click(screen.getByRole("button", { name: "Share results" }));
}
it("shares only the supplied result summary through native sharing", async () => {
  const share = vi.fn().mockResolvedValue(undefined);
  setup(share);
  await waitFor(() => expect(share).toHaveBeenCalledWith({ title: "My PracticeIELTS results", text }));
  expect(await screen.findByText("Ulashildi.")).toBeTruthy();
});
it("copies results when native sharing is unavailable", async () => {
  const copy = vi.fn().mockResolvedValue(undefined);
  setup(undefined, copy);
  await waitFor(() => expect(copy).toHaveBeenCalledWith(text));
  expect(await screen.findByText("Nusxalandi.")).toBeTruthy();
});
it("does not copy or report success when native sharing is cancelled", async () => {
  const copy = vi.fn();
  setup(vi.fn().mockRejectedValue(new DOMException("Cancelled", "AbortError")), copy);
  await waitFor(() => expect(screen.getByRole("button")).not.toBeDisabled());
  expect(copy).not.toHaveBeenCalled();
  expect(screen.getByRole("status").textContent).toBe("");
});
it("copies automatically with the browser fallback without showing a field", async () => {
  Object.defineProperty(document, "execCommand", { configurable: true, value: vi.fn(() => true) });
  setup(undefined, vi.fn().mockRejectedValue(new Error("Denied")));
  expect(await screen.findByText("Nusxalandi.")).toBeTruthy();
  expect(document.execCommand).toHaveBeenCalledWith("copy");
  expect(screen.queryByRole("textbox")).toBeNull();
  Reflect.deleteProperty(document, "execCommand");
});
it("shows a short error if both copy methods fail without claiming success", async () => {
  setup(undefined, vi.fn().mockRejectedValue(new Error("Denied")));
  expect(await screen.findByText("Nusxalanmadi. Qayta urinib ko‘ring.")).toBeTruthy();
  expect(screen.queryByRole("textbox")).toBeNull();
});
