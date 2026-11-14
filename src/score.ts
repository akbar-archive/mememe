import { retryOnce } from "./retry";
import type { JsonModel, NewsItem, Scored } from "./types";

type ScoreEntry = { id: string; score: number; safe: boolean; angle: string };

const PROMPT = `You rate tech news headlines for meme potential.

For each headline return:
- score: 1-10 (10 = everyone in tech will laugh at this)
- safe: false if it involves death, injury, disasters, war, abuse, suicide,
  or real people suffering. Layoffs are safe only if the joke targets the
  company, never the workers.
- angle: one short line describing the joke

High scores: big tech drama, product fails, absurd pricing, AI hype,
CEO behavior, outages, "they did WHAT", relatable dev pain.
Low scores: routine funding rounds, minor updates, dry policy news.

Return JSON only: [{ "id": "...", "score": 0, "safe": true, "angle": "..." }]

Headlines:
`;

function isScoreEntry(value: unknown): value is ScoreEntry {
  const v = value as ScoreEntry;
  return typeof v === "object" && v !== null
    && typeof v.id === "string" && typeof v.score === "number"
    && typeof v.safe === "boolean" && typeof v.angle === "string";
}

/** Rates all headlines of a run for meme potential in one LLM call. */
export class HeadlineScorer {
  constructor(private readonly model: JsonModel) {}

  async score(items: NewsItem[]): Promise<Scored[]> {
    if (items.length === 0) return [];
    const prompt = PROMPT + items.map((it) => JSON.stringify({ id: it.id, title: it.title, summary: it.summary })).join("\n");
    const entries = await retryOnce("scoring", async () => {
      const response = await this.model.generateJson(prompt);
      return Array.isArray(response) ? response.filter(isScoreEntry) : null;
    });
    if (!entries) throw new Error("scoring failed after retry");
    const byId = new Map(entries.map((e) => [e.id, e]));
    return items.flatMap((it) => {
      const entry = byId.get(it.id);
      return entry ? [{ ...it, score: entry.score, safe: entry.safe, angle: entry.angle }] : [];
    });
  }
}
