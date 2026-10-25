import { cleanup, render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { AudioPlayer } from "../src/components/AudioPlayer";

const originalCreate = Object.getOwnPropertyDescriptor(URL, "createObjectURL");
const originalRevoke = Object.getOwnPropertyDescriptor(URL, "revokeObjectURL");
beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi
      .fn()
      .mockResolvedValue({
        ok: true,
        status: 200,
        blob: async () => new Blob(["original audio fixture"]),
      }),
  );
  Object.defineProperty(URL, "createObjectURL", {
    configurable: true,
    value: vi.fn(() => "blob:original-timing-preview"),
  });
  Object.defineProperty(URL, "revokeObjectURL", {
    configurable: true,
    value: vi.fn(),
  });
  vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue(undefined);
  vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => {});
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  if (originalCreate)
    Object.defineProperty(URL, "createObjectURL", originalCreate);
  else Reflect.deleteProperty(URL, "createObjectURL");
  if (originalRevoke)
    Object.defineProperty(URL, "revokeObjectURL", originalRevoke);
  else Reflect.deleteProperty(URL, "revokeObjectURL");
});

it("stops a canceled preview even when its start and end have not changed", async () => {
  const { rerender } = render(
    <AudioPlayer
      url="/original-preview"
      start={1300}
      end={2450}
      playRequest={1}
    />,
  );
  await waitFor(() =>
    expect(HTMLMediaElement.prototype.play).toHaveBeenCalled(),
  );
  vi.mocked(HTMLMediaElement.prototype.pause).mockClear();
  rerender(
    <AudioPlayer
      url="/original-preview"
      start={1300}
      end={2450}
      playRequest={0}
    />,
  );
  expect(HTMLMediaElement.prototype.pause).toHaveBeenCalledTimes(1);
});
