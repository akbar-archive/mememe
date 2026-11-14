import { retryOnce } from "./retry";
import type { JsonModel, Meme, Scored, Template } from "./types";

function buildPrompt(news: Scored, templates: Template[]): string {
  const templateList = templates.map((t) => `${t.id}, ${t.name}, ${t.boxCount}`).join("\n");
  return `Make a meme about this tech news.

Headline: ${news.title}
Summary: ${news.summary}
Joke angle: ${news.angle}

Pick ONE template from this list and write the text for each box.
Keep each box under 8 words. Be actually funny, not corporate funny.
No slurs, no attacks on regular people, punch up at companies and CEOs.

Templates (id, name, box_count):
${templateList}

Return JSON only:
{ "templateId": "...", "captions": ["...", "..."], "postText": "short caption for the post" }`;
}

/** Asks the LLM to pick a template and write captions for one headline. */
export class MemeWriter {
  private readonly templatesById: Map<string, Template>;

  constructor(private readonly model: JsonModel, private readonly templates: Template[]) {
    this.templatesById = new Map(templates.map((t) => [t.id, t]));
  }

  /** `recentTemplateIds` are left out so the channel doesn't keep showing the same few templates. */
  async write(news: Scored, recentTemplateIds: string[] = []): Promise<Meme | null> {
    const allowed = this.allowedTemplates(new Set(recentTemplateIds));
    const prompt = buildPrompt(news, allowed);
    return retryOnce(`meme for "${news.title}"`, async () => this.validate(await this.model.generateJson(prompt), allowed));
  }

  private allowedTemplates(recent: Set<string>): Template[] {
    const fresh = this.templates.filter((t) => !recent.has(t.id));
    return fresh.length > 0 ? fresh : this.templates;
  }

  private validate(value: unknown, allowed: Template[]): Meme | null {
    const meme = value as Meme;
    if (typeof meme !== "object" || meme === null) return null;
    const template = this.templatesById.get(String(meme.templateId));
    if (!template || !allowed.includes(template) || !Array.isArray(meme.captions) || typeof meme.postText !== "string") return null;
    const captionsValid = meme.captions.length === template.boxCount
      && meme.captions.every((c) => typeof c === "string" && c.trim() !== "");
    if (!captionsValid) return null;
    return { templateId: template.id, captions: meme.captions, postText: meme.postText };
  }
}
