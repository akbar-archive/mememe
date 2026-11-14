import type { Publisher } from "./types";

const MAX_PHOTO_CAPTION = 1024;

/** Posts a photo with caption to a Telegram channel via the Bot API. */
export class TelegramPublisher implements Publisher {
  constructor(
    private readonly token: string,
    private readonly channel: string,
    private readonly fetchFn: typeof fetch = fetch,
  ) {}

  async publish(imageUrl: string, caption: string): Promise<void> {
    const res = await this.fetchFn(`https://api.telegram.org/bot${this.token}/sendPhoto`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: this.channel, photo: imageUrl, caption: caption.slice(0, MAX_PHOTO_CAPTION) }),
    });
    const json = (await res.json()) as { ok: boolean; description?: string };
    if (!json.ok) throw new Error(`telegram: ${json.description ?? `HTTP ${res.status}`}`);
  }
}

/** Logs instead of posting. Used with DRY_RUN=true. */
export class DryRunPublisher implements Publisher {
  async publish(imageUrl: string, caption: string): Promise<void> {
    console.log(`[dry run] would post ${imageUrl}\n${caption}\n`);
  }
}
