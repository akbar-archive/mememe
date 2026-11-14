import { readFile, writeFile } from "node:fs/promises";

export type PostRecord = {
  at: string; // ISO time, for the daily cap
  title: string; // headline, so the same story from another outlet isn't posted again
  templateId: string; // so the next posts can use a different template
};

export type SeenData = {
  ids: Record<string, string>; // id -> ISO time first seen
  posts: PostRecord[];
};

const DAY_MS = 86_400_000;

/** Tracks which news items were already handled and how many posts went out recently. */
export class SeenStore {
  private readonly ids: Record<string, string>;
  private readonly posts: PostRecord[];

  constructor(data: SeenData, private readonly now: Date, ttlDays: number) {
    const cutoff = now.getTime() - ttlDays * DAY_MS;
    const isFresh = (iso: string) => Date.parse(iso) >= cutoff;
    this.ids = Object.fromEntries(Object.entries(data.ids ?? {}).filter(([, t]) => isFresh(t)));
    this.posts = (data.posts ?? []).filter((post) => isFresh(post.at));
  }

  static async load(path: string, now: Date, ttlDays: number): Promise<SeenStore> {
    const data = JSON.parse(await readFile(path, "utf8")) as SeenData;
    return new SeenStore(data, now, ttlDays);
  }

  async save(path: string): Promise<void> {
    await writeFile(path, JSON.stringify(this.toJSON(), null, 2) + "\n");
  }

  has(id: string): boolean {
    return id in this.ids;
  }

  markSeen(ids: string[]): void {
    for (const id of ids) this.ids[id] ??= this.now.toISOString();
  }

  recordPost(title: string, templateId: string): void {
    this.posts.push({ at: this.now.toISOString(), title, templateId });
  }

  postedTitles(): string[] {
    return this.posts.map((post) => post.title);
  }

  recentTemplateIds(count: number): string[] {
    return this.posts.slice(-count).map((post) => post.templateId);
  }

  postsInLastDay(): number {
    const cutoff = this.now.getTime() - DAY_MS;
    return this.posts.filter((post) => Date.parse(post.at) >= cutoff).length;
  }

  toJSON(): SeenData {
    return { ids: { ...this.ids }, posts: [...this.posts] };
  }
}
