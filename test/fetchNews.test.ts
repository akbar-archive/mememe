import { describe, expect, it, vi } from "vitest";
import { HttpFeedReader, NewsFetcher, hashLink } from "../src/fetchNews";

const rssFeed = {
  title: "The Verge",
  items: [
    { title: " Apple  ships a thing ", link: "https://verge/a", contentSnippet: "<b>Summary</b> text", isoDate: "2026-11-14T10:00:00.000Z" },
    { title: "", link: "https://verge/no-title", isoDate: "2026-11-14T10:00:00.000Z" },
    { title: "No date", link: "https://verge/no-date" },
  ],
};

describe("NewsFetcher", () => {
  it("normalizes items and skips ones without title, link or date", async () => {
    const fetcher = new NewsFetcher(["rss1"], vi.fn().mockResolvedValue(rssFeed));
    expect(await fetcher.fetchAll()).toEqual([
      { id: hashLink("https://verge/a"), title: "Apple ships a thing", summary: "Summary text", link: "https://verge/a", source: "The Verge", publishedAt: "2026-11-14T10:00:00.000Z" },
    ]);
  });

  it("falls back to the hostname when the feed has no title", async () => {
    const fetcher = new NewsFetcher(["https://hnrss.org/frontpage"], vi.fn().mockResolvedValue({ items: rssFeed.items }));
    const [item] = await fetcher.fetchAll();
    expect(item!.source).toBe("hnrss.org");
  });

  it("ignores feeds that fail", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const parseFeed = vi.fn().mockRejectedValueOnce(new Error("boom")).mockResolvedValueOnce(rssFeed);
    const items = await new NewsFetcher(["bad", "good"], parseFeed).fetchAll();
    expect(items.map((i) => i.title)).toEqual(["Apple ships a thing"]);
  });

  it("truncates long summaries", async () => {
    const long = { title: "F", items: [{ title: "T", link: "https://l", contentSnippet: "x".repeat(2000), isoDate: "2026-11-14T10:00:00.000Z" }] };
    const [item] = await new NewsFetcher(["f"], vi.fn().mockResolvedValue(long)).fetchAll();
    expect(item!.summary.length).toBe(300);
  });
});

describe("HttpFeedReader", () => {
  const xml = `<?xml version="1.0"?><rss version="2.0"><channel><title>Feed</title>
    <item><title>Hello</title><link>https://h/1</link><pubDate>Sat, 14 Nov 2026 10:00:00 GMT</pubDate></item>
  </channel></rss>`;

  it("downloads with a user agent and timeout, then parses the XML", async () => {
    const fetchFn = vi.fn().mockResolvedValue(new Response(xml));
    const feed = await new HttpFeedReader(fetchFn, 5000).read("https://f");
    expect(feed.title).toBe("Feed");
    expect(feed.items[0]).toMatchObject({ title: "Hello", link: "https://h/1", isoDate: "2026-11-14T10:00:00.000Z" });
    const init = fetchFn.mock.calls[0]![1];
    expect(init.headers["User-Agent"]).toBeTruthy();
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it("throws on HTTP errors and drains the body so the socket closes", async () => {
    const res = new Response("slow down", { status: 429 });
    const fetchFn = vi.fn().mockResolvedValue(res);
    await expect(new HttpFeedReader(fetchFn, 5000).read("https://f")).rejects.toThrow("HTTP 429");
    expect(res.bodyUsed).toBe(true);
  });
});
