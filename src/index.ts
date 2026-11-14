import { readFile } from "node:fs/promises";
import { CONFIG, FEEDS, PATHS } from "./config";
import { loadLocalEnv, requireEnv } from "./env";
import { HttpFeedReader, NewsFetcher } from "./fetchNews";
import { GeminiJsonModel } from "./gemini";
import { ImgflipClient } from "./imgflip";
import { MemeWriter } from "./makeMeme";
import { MemeBot } from "./memeBot";
import { HeadlineScorer } from "./score";
import { SeenStore } from "./seenStore";
import { DryRunPublisher, TelegramPublisher } from "./telegram";
import type { Publisher, Template } from "./types";

const FEED_TIMEOUT_MS = 15_000;
const DEFAULT_GEMINI_MODEL = "gemini-3.6-flash";

loadLocalEnv();
const dryRun = process.env.DRY_RUN === "true";
const env = requireEnv(["GEMINI_API_KEY", "IMGFLIP_USER", "IMGFLIP_PASS", ...(dryRun ? [] : ["TG_TOKEN", "TG_CHANNEL"])]);

async function main(): Promise<void> {
  const now = new Date();
  const templates = JSON.parse(await readFile(PATHS.templates, "utf8")) as Template[];
  const seen = await SeenStore.load(PATHS.seen, now, CONFIG.seenTtlDays);
  const feedReader = new HttpFeedReader(fetch, FEED_TIMEOUT_MS);
  const model = new GeminiJsonModel(env.GEMINI_API_KEY!, process.env.GEMINI_MODEL || DEFAULT_GEMINI_MODEL);
  const publisher: Publisher = dryRun ? new DryRunPublisher() : new TelegramPublisher(env.TG_TOKEN!, env.TG_CHANNEL!);

  const bot = new MemeBot(
    {
      fetcher: new NewsFetcher(FEEDS, (url) => feedReader.read(url)),
      scorer: new HeadlineScorer(model),
      writer: new MemeWriter(model, templates),
      renderer: new ImgflipClient(env.IMGFLIP_USER!, env.IMGFLIP_PASS!),
      publisher,
      seen,
    },
    CONFIG,
  );
  await bot.run(now);

  // Dry runs leave seen.json alone so the same headlines can be retried while tuning prompts.
  if (!dryRun) await seen.save(PATHS.seen);
}

// Exit 0 even on failure so one bad run doesn't spam failure emails; missing secrets exit 1 above.
main().catch((err) => console.error("run failed:", err));
