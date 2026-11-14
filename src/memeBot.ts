import { dedupeSimilar } from "./dedupe";
import type { NewsFetcher } from "./fetchNews";
import type { ImgflipClient } from "./imgflip";
import type { HeadlineScorer } from "./score";
import type { MemeWriter } from "./makeMeme";
import { isBlocked } from "./safety";
import type { SeenStore } from "./seenStore";
import type { NewsItem, Publisher, Scored } from "./types";

const HOUR_MS = 3_600_000;

export type BotSettings = {
  maxPostsPerRun: number;
  minScore: number;
  maxAgeHours: number;
  maxPostsPerDay: number;
  similarityThreshold: number;
  recentTemplatesToAvoid: number;
};

export type BotDeps = {
  fetcher: Pick<NewsFetcher, "fetchAll">;
  scorer: Pick<HeadlineScorer, "score">;
  writer: Pick<MemeWriter, "write">;
  renderer: Pick<ImgflipClient, "render">;
  publisher: Publisher;
  seen: SeenStore;
};

/** One bot run: fetch news, pick the most meme-able headlines, render and post them. */
export class MemeBot {
  constructor(private readonly deps: BotDeps, private readonly settings: BotSettings) {}

  async run(now: Date): Promise<void> {
    const fetched = await this.deps.fetcher.fetchAll();
    const candidates = this.selectCandidates(fetched, now);
    console.log(`fetched ${fetched.length}, ${candidates.length} new candidates`);

    const slotsLeft = Math.min(this.settings.maxPostsPerRun, this.settings.maxPostsPerDay - this.deps.seen.postsInLastDay());
    if (slotsLeft > 0 && candidates.length > 0) {
      const winners = this.pickWinners(await this.deps.scorer.score(candidates), slotsLeft);
      for (const winner of winners) await this.postMeme(winner);
    } else if (slotsLeft <= 0) {
      console.log("daily post cap reached, skipping");
    }

    // Mark everything fetched, not just what was posted, so nothing loops forever.
    // Not reached when scoring throws, so a Gemini outage doesn't lose the batch.
    this.deps.seen.markSeen(fetched.map((item) => item.id));
  }

  private selectCandidates(items: NewsItem[], now: Date): NewsItem[] {
    const oldestAllowed = now.getTime() - this.settings.maxAgeHours * HOUR_MS;
    const uniqueById = [...new Map(items.map((item) => [item.id, item])).values()];
    const fresh = uniqueById.filter((item) =>
      !this.deps.seen.has(item.id)
      && Date.parse(item.publishedAt) >= oldestAllowed
      && !isBlocked(item.title));
    return dedupeSimilar(fresh, this.settings.similarityThreshold, this.deps.seen.postedTitles());
  }

  private pickWinners(scored: Scored[], limit: number): Scored[] {
    return scored
      .filter((item) => item.safe && item.score >= this.settings.minScore)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }

  private async postMeme(news: Scored): Promise<void> {
    const recentTemplates = this.deps.seen.recentTemplateIds(this.settings.recentTemplatesToAvoid);
    const meme = await this.deps.writer.write(news, recentTemplates);
    if (!meme) return;
    try {
      const imageUrl = await this.deps.renderer.render(meme);
      await this.deps.publisher.publish(imageUrl, `${meme.postText}\n\nsource: ${news.link}`);
      this.deps.seen.recordPost(news.title, meme.templateId);
      console.log(`posted (score ${news.score}): ${news.title}`);
    } catch (err) {
      console.error(`failed to post "${news.title}": ${String(err)}`);
    }
  }
}
