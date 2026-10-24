import { afterEach, expect, it, vi } from "vitest";
import { api } from "../src/services/api";

afterEach(() => vi.unstubAllGlobals());

it("shows the question number and field for nested validation errors", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
    ok: false,
    status: 400,
    json: async () => ({
      questions: {
        "0": { max_words: ["An accepted answer exceeds the word limit."] },
      },
    }),
  }));

  await expect(api("materials/3/questions/", { method: "PUT" })).rejects.toThrow(
    "Question 1 — Maximum answer words: An accepted answer exceeds the word limit.",
  );
});
