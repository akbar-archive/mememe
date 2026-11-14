import type { Meme, Template } from "./types";

const API = "https://api.imgflip.com";

type ImgflipMeme = { id: string; name: string; box_count: number };
type ImgflipResponse<T> = { success: boolean; data?: T; error_message?: string };

async function unwrap<T>(res: Response): Promise<T> {
  const json = (await res.json()) as ImgflipResponse<T>;
  if (!json.success || !json.data) throw new Error(`imgflip: ${json.error_message ?? `HTTP ${res.status}`}`);
  return json.data;
}

export function curateTemplates(memes: ImgflipMeme[], curatedNames: string[]): Template[] {
  const wanted = new Set(curatedNames.map((n) => n.toLowerCase()));
  return memes
    .filter((m) => wanted.has(m.name.toLowerCase()))
    .map((m) => ({ id: m.id, name: m.name, boxCount: m.box_count }));
}

/** Talks to the imgflip API: lists templates and renders captioned memes. */
export class ImgflipClient {
  constructor(
    private readonly username: string,
    private readonly password: string,
    private readonly fetchFn: typeof fetch = fetch,
  ) {}

  async render(meme: Meme): Promise<string> {
    const body = new URLSearchParams({ template_id: meme.templateId, username: this.username, password: this.password });
    meme.captions.forEach((text, i) => body.append(`boxes[${i}][text]`, text));
    const res = await this.fetchFn(`${API}/caption_image`, { method: "POST", body });
    const data = await unwrap<{ url: string }>(res);
    return data.url;
  }

  async listTopTemplates(): Promise<ImgflipMeme[]> {
    const data = await unwrap<{ memes: ImgflipMeme[] }>(await this.fetchFn(`${API}/get_memes`));
    return data.memes;
  }
}
