import { describe, it, expect, vi, afterEach } from "vitest";
import { restore } from "../src/services/api";
import { useAuth } from "../src/stores/auth";
afterEach(() => {
  vi.unstubAllGlobals();
  useAuth.getState().clear();
});
describe("JWT refresh concurrency", () => {
  it("shares a rotating refresh request between concurrent callers", async () => {
    const user = {
      id: 1,
      username: "learner",
      email: "",
      role: "student",
      can_edit: false,
    };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ csrfToken: "test-csrf" }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ access: "test-access", user }),
      });
    vi.stubGlobal("fetch", fetchMock);
    await Promise.all([restore(), restore(), restore()]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(useAuth.getState().user?.username).toBe("learner");
  });
});
