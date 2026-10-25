import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Practice } from "../src/features/Practice";
import { api, type Session } from "../src/services/api";

vi.mock("../src/services/api", () => ({ api: vi.fn(), post: vi.fn() }));
vi.mock("../src/components/AudioPlayer", () => ({
  AudioPlayer: ({
    start,
    end,
    playRequest,
  }: {
    start: number;
    end: number;
    playRequest?: number;
  }) => (
    <output data-testid="playback-window" data-play-request={playRequest}>
      {start}–{end}
    </output>
  ),
}));

const initial = (): Session => ({
  id: 15,
  material: 3,
  title: "Original listening",
  version: 4,
  difficulty: "easy",
  position: 1,
  drafts: { "1": "my saved answer" },
  timing_revision: null,
  can_edit_timing: true,
  groups: [
    { start_ms: 100, end_ms: 1500, speaker: "", word_count: 6 },
    { start_ms: 2000, end_ms: 4000, speaker: "", word_count: 6 },
    { start_ms: 5000, end_ms: 6500, speaker: "", word_count: 4 },
  ],
  audio: {
    id: 1,
    duration_ms: 10000,
    mime_type: "audio/wav",
    size: 100,
    stream_url: "/audio",
  },
  checked_positions: [],
});
let session: Session;

beforeEach(() => {
  session = initial();
  vi.mocked(api).mockReset();
  vi.mocked(api).mockImplementation(async (path, options) => {
    const body = options?.body ? JSON.parse(String(options.body)) : {};
    if (path.endsWith("/timing/")) {
      session = {
        ...session,
        timing_revision: 8,
        groups: session.groups.map((g, i) =>
          i === body.position
            ? { ...g, start_ms: body.start_ms, end_ms: body.end_ms }
            : g,
        ),
      };
    } else if (options?.method === "PATCH") {
      session = {
        ...session,
        position: body.position,
        drafts: { ...session.drafts, [body.draft_position]: body.draft },
      };
    }
    return session as never;
  });
});
afterEach(cleanup);

function show(value = session) {
  session = value;
  const router = createMemoryRouter(
    [{ path: "/practice/:id", element: <Practice /> }],
    { initialEntries: ["/practice/15"] },
  );
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  render(
    <QueryClientProvider client={client}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
}

async function openEditor() {
  fireEvent.click(await screen.findByRole("button", { name: "Adjust timing" }));
}

describe("Admin Easy Practice timing", () => {
  it("previews precise boundaries and saves the active chunk with answers retained", async () => {
    show();
    await openEditor();
    fireEvent.change(screen.getByLabelText("Start time (seconds)"), {
      target: { value: "2.123" },
    });
    fireEvent.change(screen.getByLabelText("End time (seconds)"), {
      target: { value: "4.456" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Preview timing" }));
    expect(screen.getByTestId("playback-window")).toHaveTextContent(
      "2123–4456",
    );
    fireEvent.click(screen.getByRole("button", { name: "Save timing" }));
    await waitFor(() =>
      expect(vi.mocked(api)).toHaveBeenCalledWith(
        "sessions/15/timing/",
        expect.objectContaining({
          method: "PATCH",
          body: JSON.stringify({
            position: 1,
            start_ms: 2123,
            end_ms: 4456,
            revision: null,
          }),
        }),
      ),
    );
    expect(
      await screen.findByText("Timing saved for Easy Practice."),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("What did you hear?")).toHaveValue(
      "my saved answer",
    );
    expect(screen.getByTestId("playback-window")).toHaveTextContent(
      "2123–4456",
    );
  });

  it.each([
    { can_edit_timing: false },
    { difficulty: "medium", can_edit_timing: true },
    { difficulty: "hard", can_edit_timing: true },
  ])(
    "hides correction controls for unsupported sessions: %o",
    async (values) => {
      show({ ...session, ...values });
      await screen.findByRole("heading", { name: "Listen and write" });
      expect(
        screen.queryByRole("button", { name: "Adjust timing" }),
      ).not.toBeInTheDocument();
    },
  );

  it("allows wider preview but prevents saving a window that overlaps the next exercise", async () => {
    show();
    await openEditor();
    fireEvent.change(screen.getByLabelText("End time (seconds)"), {
      target: { value: "5.100" },
    });
    expect(screen.getByRole("button", { name: "Save timing" })).toBeDisabled();
    expect(screen.getByText(/overlaps the next exercise/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Preview timing" }));
    expect(screen.getByTestId("playback-window")).toHaveTextContent(
      "2000–5100",
    );
    fireEvent.click(screen.getByRole("button", { name: "Cancel timing edit" }));
    expect(screen.getByTestId("playback-window")).toHaveTextContent(
      "2000–4000",
    );
    expect(screen.getByTestId("playback-window")).toHaveAttribute(
      "data-play-request",
      "0",
    );
    expect(
      vi.mocked(api).mock.calls.some(([path]) => path.endsWith("/timing/")),
    ).toBe(false);
  });

  it("rejects empty, excessive precision and out-of-audio input and nudges by 100ms", async () => {
    show();
    await openEditor();
    fireEvent.click(
      screen.getByRole("button", { name: "Start earlier by 0.1 seconds" }),
    );
    expect(screen.getByLabelText("Start time (seconds)")).toHaveValue("1.900");
    fireEvent.change(screen.getByLabelText("Start time (seconds)"), {
      target: { value: "" },
    });
    expect(
      screen.getByRole("button", { name: "Preview timing" }),
    ).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Start time (seconds)"), {
      target: { value: "2.0001" },
    });
    expect(screen.getByRole("button", { name: "Save timing" })).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Start time (seconds)"), {
      target: { value: "2.000" },
    });
    fireEvent.change(screen.getByLabelText("End time (seconds)"), {
      target: { value: "10.001" },
    });
    expect(
      screen.getByRole("button", { name: "Preview timing" }),
    ).toBeDisabled();
  });

  it("shows a failed save without replacing playback or losing the answer", async () => {
    const fallback = vi.mocked(api).getMockImplementation()!;
    vi.mocked(api).mockImplementation(async (path, options) => {
      if (path.endsWith("/timing/"))
        throw new Error("Timing has changed. Reopen the latest Easy Practice.");
      return fallback(path, options);
    });
    show();
    await openEditor();
    fireEvent.change(screen.getByLabelText("Start time (seconds)"), {
      target: { value: "2.100" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save timing" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Timing has changed",
    );
    expect(screen.getByTestId("playback-window")).toHaveTextContent(
      "2000–4000",
    );
    expect(screen.getByLabelText("What did you hear?")).toHaveValue(
      "my saved answer",
    );
  });
});
