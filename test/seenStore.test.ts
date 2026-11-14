import { describe, expect, it } from "vitest";
import { SeenStore } from "../src/seenStore";

const now = new Date("2026-11-14T12:00:00Z");
const daysAgo = (d: number) => new Date(now.getTime() - d * 86_400_000).toISOString();

describe("SeenStore", () => {
  it("prunes ids and posts older than the TTL", () => {
    const store = new SeenStore({ ids: { old: daysAgo(8), fresh: daysAgo(1) }, posts: [{ at: daysAgo(8), title: "old", templateId: "1" }, { at: daysAgo(0.5), title: "new", templateId: "2" }] }, now, 7);
    expect(store.has("old")).toBe(false);
    expect(store.has("fresh")).toBe(true);
    expect(store.toJSON().posts).toHaveLength(1);
  });

  it("records seen ids with the current time", () => {
    const store = new SeenStore({ ids: {}, posts: [] }, now, 7);
    store.markSeen(["a", "b"]);
    expect(store.toJSON().ids).toEqual({ a: now.toISOString(), b: now.toISOString() });
  });

  it("counts only posts from the last 24 hours", () => {
    const store = new SeenStore({ ids: {}, posts: [{ at: daysAgo(2), title: "x", templateId: "1" }, { at: daysAgo(0.9), title: "y", templateId: "2" }] }, now, 7);
    store.recordPost("z", "3");
    expect(store.postsInLastDay()).toBe(2);
  });

  it("remembers titles of posts still within the TTL", () => {
    const store = new SeenStore({ ids: {}, posts: [{ at: daysAgo(8), title: "expired", templateId: "1" }, { at: daysAgo(1), title: "recent", templateId: "2" }] }, now, 7);
    store.recordPost("just now", "3");
    expect(store.postedTitles()).toEqual(["recent", "just now"]);
  });

  it("lists the templates of the most recent posts, newest last", () => {
    const posts = ["a", "b", "c"].map((templateId, i) => ({ at: daysAgo(3 - i), title: templateId, templateId }));
    const store = new SeenStore({ ids: {}, posts }, now, 7);
    expect(store.recentTemplateIds(2)).toEqual(["b", "c"]);
  });

  it("treats a missing posts field as empty", () => {
    const store = new SeenStore({ ids: {} } as never, now, 7);
    expect(store.postsInLastDay()).toBe(0);
  });
});
