import { createHash } from "node:crypto";
import Parser from "rss-parser";
import type { NewsItem } from "./types";

const MAX_SUMMARY_CHARS = 300;
const USER_AGENT = "tech-meme-bot/1.0 (RSS reader)";

export type RssItem = { title?: string; link?: string; contentSnippet?: string; isoDate?: string };
export type RssFeed = { title?: string; items: RssItem[] };
export type FeedParser = (url: string) => Promise<RssFeed>;

export function hashLink(link: string): string {
  return createHash("sha1").update(link).digest("hex");
}

function clean(text: string | undefined): string {
  return (text ?? "").replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
}

function toNewsItem(item: RssItem, source: string): NewsItem | null {
  const title = clean(item.title);
  const publishedAt = item.isoDate ?? "";
  if (!title || !item.link || Number.isNaN(Date.parse(publishedAt))) return null;
  const summary = clean(item.contentSnippet).slice(0, MAX_SUMMARY_CHARS);
  return { id: hashLink(item.link), title, summary, link: item.link, source, publishedAt };
}

/**
 * Downloads a feed with fetch and parses it with rss-parser.
 * rss-parser's own HTTP client leaves sockets open on error statuses and never aborts
 * slow requests, which kept the process from exiting.
 */
export class HttpFeedReader {
  private readonly parser = new Parser();

  constructor(private readonly fetchFn: typeof fetch, private readonly timeoutMs: number) {}

  async read(url: string): Promise<RssFeed> {
    const res = await this.fetchFn(url, {
      headers: { "User-Agent": USER_AGENT },
      signal: AbortSignal.timeout(this.timeoutMs),
    });
    const body = await res.text();
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return this.parser.parseString(body);
  }
}

/** Pulls headlines from RSS feeds and normalizes them into NewsItems. */
export class NewsFetcher {
  constructor(private readonly feedUrls: string[], private readonly parseFeed: FeedParser) {}

  async fetchAll(): Promise<NewsItem[]> {
    const results = await Promise.allSettled(this.feedUrls.map((url) => this.fetchFeed(url)));
    return results.flatMap((result, i) => {
      if (result.status === "fulfilled") return result.value;
      console.warn(`feed failed: ${this.feedUrls[i]}: ${String(result.reason)}`);
      return [];
    });
  }

  private async fetchFeed(url: string): Promise<NewsItem[]> {
    const feed = await this.parseFeed(url);
    const source = clean(feed.title) || new URL(url).hostname;
    return feed.items
      .map((item) => toNewsItem(item, source))
      .filter((item): item is NewsItem => item !== null);
  }
}
