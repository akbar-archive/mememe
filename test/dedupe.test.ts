import { describe, expect, it } from "vitest";
import { dedupeSimilar, jaccard, titleWords } from "../src/dedupe";
import type { NewsItem } from "../src/types";

const item = (id: string, title: string): NewsItem => ({
  id, title, summary: "", link: `https://x/${id}`, source: "s", publishedAt: "2026-11-14T00:00:00Z",
});

describe("titleWords", () => {
  it("lowercases, strips punctuation and stopwords", () => {
    expect([...titleWords("The iPhone 17 is HERE!")].sort()).toEqual(["17", "here", "iphone"]);
  });
});

describe("jaccard", () => {
  it("returns overlap ratio and handles empty sets", () => {
    expect(jaccard(new Set(["a", "b"]), new Set(["b", "c"]))).toBeCloseTo(1 / 3);
    expect(jaccard(new Set(), new Set())).toBe(0);
  });
});

describe("dedupeSimilar", () => {
  it("keeps only the first of near-identical headlines", () => {
    const items = [
      item("1", "Google announces Gemini 4 model today"),
      item("2", "Google announces new Gemini 4 model"),
      item("3", "Tesla recalls Cybertruck over wiper"),
    ];
    expect(dedupeSimilar(items, 0.5).map((i) => i.id)).toEqual(["1", "3"]);
  });
});
