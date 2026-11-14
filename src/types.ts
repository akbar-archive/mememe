export type NewsItem = {
  id: string; // sha1 of link
  title: string;
  summary: string;
  link: string;
  source: string;
  publishedAt: string;
};

export type Scored = NewsItem & {
  score: number; // 1-10 meme potential
  safe: boolean; // false for tragedies, deaths, etc.
  angle: string; // one-line idea for the joke
};

export type Template = {
  id: string;
  name: string;
  boxCount: number;
};

export type Meme = {
  templateId: string;
  captions: string[]; // one per text box
  postText: string; // telegram caption
};

/** Boundary to the LLM: send a prompt, get parsed JSON back. */
export interface JsonModel {
  generateJson(prompt: string): Promise<unknown>;
}

/** Boundary to the channel we post to. */
export interface Publisher {
  publish(imageUrl: string, caption: string): Promise<void>;
}
