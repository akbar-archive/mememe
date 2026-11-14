import type { NewsItem } from "./types";

const STOPWORDS = new Set([
  "a", "an", "the", "and", "or", "but", "of", "to", "in", "on", "at", "for", "with",
  "by", "from", "is", "are", "was", "were", "be", "it", "its", "this", "that", "as",
  "new", "now", "after", "over", "about", "into", "up", "out", "has", "have", "will",
]);

export function titleWords(title: string): Set<string> {
  const words = title
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter((w) => w && !STOPWORDS.has(w));
  return new Set(words);
}

export function jaccard(a: Set<string>, b: Set<string>): number {
  const unionSize = new Set([...a, ...b]).size;
  if (unionSize === 0) return 0;
  const intersectionSize = [...a].filter((w) => b.has(w)).length;
  return intersectionSize / unionSize;
}

/**
 * Same story from several outlets: keep the first, drop the rest.
 * Items matching an `alreadyPosted` title are dropped too, so a story isn't posted twice across runs.
 */
export function dedupeSimilar(items: NewsItem[], threshold: number, alreadyPosted: string[] = []): NewsItem[] {
  const keptWords = alreadyPosted.map(titleWords);
  const kept: NewsItem[] = [];
  for (const item of items) {
    const words = titleWords(item.title);
    const isDuplicate = keptWords.some((other) => jaccard(other, words) > threshold);
    if (isDuplicate) continue;
    keptWords.push(words);
    kept.push(item);
  }
  return kept;
}
