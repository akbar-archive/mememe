import { describe, expect, it, vi } from "vitest";
import { MemeWriter } from "../src/makeMeme";
import type { JsonModel, Scored, Template } from "../src/types";

const templates: Template[] = [
  { id: "181913649", name: "Drake Hotline Bling", boxCount: 2 },
  { id: "87743020", name: "Two Buttons", boxCount: 3 },
];
const news: Scored = { id: "1", title: "Big headline", summary: "sum", link: "l", source: "s", publishedAt: "x", score: 9, safe: true, angle: "the angle" };
const model = (...responses: unknown[]): JsonModel => {
  const fn = vi.fn();
  responses.forEach((r) => fn.mockResolvedValueOnce(r));
  return { generateJson: fn };
};

describe("MemeWriter", () => {
  it("returns a valid meme", async () => {
    const meme = { templateId: "181913649", captions: ["a", "b"], postText: "post" };
    expect(await new MemeWriter(model(meme), templates).write(news)).toEqual(meme);
  });

  it("includes headline, angle and templates in the prompt", async () => {
    const m = model({ templateId: "181913649", captions: ["a", "b"], postText: "p" });
    await new MemeWriter(m, templates).write(news);
    const prompt = vi.mocked(m.generateJson).mock.calls[0]![0];
    expect(prompt).toContain("Big headline");
    expect(prompt).toContain("the angle");
    expect(prompt).toContain("87743020, Two Buttons, 3");
  });

  it("leaves recently used templates out of the prompt and rejects them", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const m = model(
      { templateId: "181913649", captions: ["a", "b"], postText: "p" },
      { templateId: "87743020", captions: ["a", "b", "c"], postText: "p" },
    );
    const meme = await new MemeWriter(m, templates).write(news, ["181913649"]);
    const prompt = vi.mocked(m.generateJson).mock.calls[0]![0];
    expect(prompt).not.toContain("Drake Hotline Bling");
    expect(meme?.templateId).toBe("87743020");
  });

  it("falls back to every template when all were used recently", async () => {
    const m = model({ templateId: "181913649", captions: ["a", "b"], postText: "p" });
    expect(await new MemeWriter(m, templates).write(news, ["181913649", "87743020"])).not.toBeNull();
  });

  it("retries once when the caption count does not match the box count", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const m = model(
      { templateId: "87743020", captions: ["only one"], postText: "p" },
      { templateId: "87743020", captions: ["a", "b", "c"], postText: "p" },
    );
    expect((await new MemeWriter(m, templates).write(news))?.captions).toHaveLength(3);
    expect(m.generateJson).toHaveBeenCalledTimes(2);
  });

  it("gives up after two bad answers", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const m = model({ templateId: "unknown", captions: ["a", "b"], postText: "p" }, { templateId: "181913649", captions: ["", "b"], postText: "p" });
    expect(await new MemeWriter(m, templates).write(news)).toBeNull();
  });

  it("does not crash when the model throws", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const fn = vi.fn().mockRejectedValue(new Error("rate limited"));
    expect(await new MemeWriter({ generateJson: fn }, templates).write(news)).toBeNull();
  });
});
