import { describe, expect, it, vi } from "vitest";
import { HeadlineScorer } from "../src/score";
import type { JsonModel, NewsItem } from "../src/types";

const item = (id: string): NewsItem => ({ id, title: `T${id}`, summary: "s", link: `l${id}`, source: "src", publishedAt: "2026-11-14T00:00:00Z" });
const model = (...responses: unknown[]): JsonModel => {
  const fn = vi.fn();
  responses.forEach((r) => (r instanceof Error ? fn.mockRejectedValueOnce(r) : fn.mockResolvedValueOnce(r)));
  return { generateJson: fn };
};

describe("HeadlineScorer", () => {
  it("merges scores into items and ignores unknown or malformed entries", async () => {
    const scorer = new HeadlineScorer(model([
      { id: "1", score: 9, safe: true, angle: "lol" },
      { id: "2", score: "high", safe: true, angle: "bad" },
      { id: "ghost", score: 10, safe: true, angle: "x" },
    ]));
    const scored = await scorer.score([item("1"), item("2")]);
    expect(scored).toEqual([{ ...item("1"), score: 9, safe: true, angle: "lol" }]);
  });

  it("puts every headline in the prompt", async () => {
    const m = model([]);
    await new HeadlineScorer(m).score([item("a"), item("b")]);
    const prompt = vi.mocked(m.generateJson).mock.calls[0]![0];
    expect(prompt).toContain("Ta");
    expect(prompt).toContain("Tb");
  });

  it("retries once when the response is not an array, then throws so the run can retry later", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const scorer = new HeadlineScorer(model({ nope: 1 }, new Error("bad json")));
    await expect(scorer.score([item("1")])).rejects.toThrow("scoring failed");
  });

  it("succeeds on the retry", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const scorer = new HeadlineScorer(model("garbage", [{ id: "1", score: 8, safe: false, angle: "a" }]));
    expect(await scorer.score([item("1")])).toHaveLength(1);
  });

  it("skips the model call for no items", async () => {
    const m = model();
    expect(await new HeadlineScorer(m).score([])).toEqual([]);
    expect(m.generateJson).not.toHaveBeenCalled();
  });
});
