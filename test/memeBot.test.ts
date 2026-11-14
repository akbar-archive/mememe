import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemeBot, type BotSettings } from "../src/memeBot";
import { SeenStore } from "../src/seenStore";
import type { Meme, NewsItem, Scored } from "../src/types";

const now = new Date("2026-11-14T12:00:00Z");
const hoursAgo = (h: number) => new Date(now.getTime() - h * 3_600_000).toISOString();
const news = (id: string, title: string, ageHours = 1): NewsItem => ({ id, title, summary: "", link: `l${id}`, source: "s", publishedAt: hoursAgo(ageHours) });
const settings: BotSettings = { maxPostsPerRun: 2, minScore: 7, maxAgeHours: 6, maxPostsPerDay: 12, similarityThreshold: 0.5, recentTemplatesToAvoid: 15 };
const meme: Meme = { templateId: "1", captions: ["a", "b"], postText: "funny" };

function setup(items: NewsItem[], scores: Record<string, Partial<Scored>>, seen = new SeenStore({ ids: {}, posts: [] }, now, 7)) {
  const deps = {
    fetcher: { fetchAll: vi.fn().mockResolvedValue(items) },
    scorer: {
      score: vi.fn(async (input: NewsItem[]) =>
        input.filter((i) => scores[i.id]).map((i) => ({ ...i, score: 0, safe: true, angle: "", ...scores[i.id] }) as Scored)),
    },
    writer: { write: vi.fn().mockResolvedValue(meme) },
    renderer: { render: vi.fn().mockResolvedValue("https://img") },
    publisher: { publish: vi.fn().mockResolvedValue(undefined) },
    seen,
  };
  return { deps, bot: new MemeBot(deps, settings) };
}

beforeEach(() => {
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("MemeBot.run", () => {
  it("posts the top-scoring safe items with the source link", async () => {
    const { deps, bot } = setup(
      [news("a", "Alpha launches widget"), news("b", "Beta raises prices"), news("c", "Gamma outage today"), news("d", "Delta unsafe story")],
      { a: { score: 7 }, b: { score: 9 }, c: { score: 8 }, d: { score: 10, safe: false } },
    );
    await bot.run(now);

    const posted = deps.writer.write.mock.calls.map(([s]) => s.id);
    expect(posted).toEqual(["b", "c"]);
    expect(deps.publisher.publish).toHaveBeenCalledWith("https://img", "funny\n\nsource: lb");
    expect(deps.seen.postsInLastDay()).toBe(2);
    expect(deps.seen.postedTitles()).toEqual(["Beta raises prices", "Gamma outage today"]);
  });

  it("filters seen, stale, blocklisted and duplicate headlines before scoring", async () => {
    const seen = new SeenStore({ ids: { old: hoursAgo(1) }, posts: [] }, now, 7);
    const { deps, bot } = setup(
      [
        news("old", "Already seen story"),
        news("stale", "Stale story here", 7),
        news("blocked", "Two dead in robotaxi crash"),
        news("x1", "Microsoft buys Discord for billions"),
        news("x2", "Microsoft buys Discord for billions, report says"),
        news("x1", "Microsoft buys Discord for billions"),
      ],
      {},
      seen,
    );
    await bot.run(now);
    expect(deps.scorer.score.mock.calls[0]![0].map((i: NewsItem) => i.id)).toEqual(["x1"]);
  });

  it("skips stories already posted in an earlier run, even from another outlet", async () => {
    const seen = new SeenStore({ ids: {}, posts: [{ at: hoursAgo(5), title: "Workday outage locks millions of employees out of account", templateId: "9" }] }, now, 7);
    const { deps, bot } = setup(
      [news("w", "Outage at HR platform Workday locks millions of employees out of their account"), news("n", "Nvidia unveils new GPU")],
      {},
      seen,
    );
    await bot.run(now);
    expect(deps.scorer.score.mock.calls[0]![0].map((i: NewsItem) => i.id)).toEqual(["n"]);
  });

  it("leaves items unseen when scoring fails, so the next run retries them", async () => {
    const { deps, bot } = setup([news("a", "Alpha story")], {});
    deps.scorer.score.mockRejectedValueOnce(new Error("scoring failed"));
    await expect(bot.run(now)).rejects.toThrow("scoring failed");
    expect(deps.seen.has("a")).toBe(false);
  });

  it("marks every fetched item as seen, even ones not posted", async () => {
    const { deps, bot } = setup([news("a", "Alpha story"), news("b", "Beta story", 10)], {});
    await bot.run(now);
    expect(deps.seen.has("a")).toBe(true);
    expect(deps.seen.has("b")).toBe(true);
  });

  it("respects the daily post cap", async () => {
    const seen = new SeenStore({ ids: {}, posts: Array(11).fill({ at: hoursAgo(2), title: "old", templateId: "9" }) }, now, 7);
    const { deps, bot } = setup([news("a", "Alpha story"), news("b", "Beta thing")], { a: { score: 9 }, b: { score: 9 } }, seen);
    await bot.run(now);
    expect(deps.publisher.publish).toHaveBeenCalledTimes(1);
  });

  it("skips scoring entirely when the daily cap is reached", async () => {
    const seen = new SeenStore({ ids: {}, posts: Array(12).fill({ at: hoursAgo(2), title: "old", templateId: "9" }) }, now, 7);
    const { deps, bot } = setup([news("a", "Alpha story")], { a: { score: 9 } }, seen);
    await bot.run(now);
    expect(deps.scorer.score).not.toHaveBeenCalled();
    expect(deps.seen.has("a")).toBe(true);
  });

  it("keeps going when rendering or posting one meme fails, and does not count it", async () => {
    const { deps, bot } = setup([news("a", "Alpha story"), news("b", "Beta thing")], { a: { score: 9 }, b: { score: 8 } });
    deps.renderer.render.mockRejectedValueOnce(new Error("imgflip down"));
    await bot.run(now);
    expect(deps.publisher.publish).toHaveBeenCalledTimes(1);
    expect(deps.seen.postsInLastDay()).toBe(1);
    expect(deps.seen.has("a")).toBe(true);
  });

  it("asks the writer to avoid templates used in recent posts, including this run's", async () => {
    const seen = new SeenStore({ ids: {}, posts: [{ at: hoursAgo(3), title: "Old story", templateId: "7" }] }, now, 7);
    const { deps, bot } = setup([news("a", "Alpha story"), news("b", "Beta thing")], { a: { score: 9 }, b: { score: 8 } }, seen);
    await bot.run(now);
    expect(deps.writer.write.mock.calls.map(([, avoid]) => avoid)).toEqual([["7"], ["7", "1"]]);
  });

  it("skips an item when the writer gives up", async () => {
    const { deps, bot } = setup([news("a", "Alpha story")], { a: { score: 9 } });
    deps.writer.write.mockResolvedValueOnce(null);
    await bot.run(now);
    expect(deps.renderer.render).not.toHaveBeenCalled();
  });
});
