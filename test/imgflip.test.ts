import { describe, expect, it, vi } from "vitest";
import { ImgflipClient, curateTemplates } from "../src/imgflip";

const json = (body: unknown) => new Response(JSON.stringify(body));

describe("ImgflipClient.render", () => {
  it("posts template, credentials and captions and returns the image url", async () => {
    const fetchFn = vi.fn().mockResolvedValue(json({ success: true, data: { url: "https://i.imgflip.com/x.jpg" } }));
    const url = await new ImgflipClient("user", "pass", fetchFn).render({ templateId: "42", captions: ["top", "bottom"], postText: "" });

    expect(url).toBe("https://i.imgflip.com/x.jpg");
    const [endpoint, init] = fetchFn.mock.calls[0]!;
    expect(endpoint).toBe("https://api.imgflip.com/caption_image");
    const body = init.body as URLSearchParams;
    expect(body.get("template_id")).toBe("42");
    expect(body.get("username")).toBe("user");
    expect(body.get("boxes[0][text]")).toBe("top");
    expect(body.get("boxes[1][text]")).toBe("bottom");
  });

  it("throws imgflip's error message on failure", async () => {
    const fetchFn = vi.fn().mockResolvedValue(json({ success: false, error_message: "bad login" }));
    await expect(new ImgflipClient("u", "p", fetchFn).render({ templateId: "1", captions: ["a"], postText: "" })).rejects.toThrow("bad login");
  });
});

describe("curateTemplates", () => {
  it("keeps only curated names, case-insensitively", () => {
    const memes = [
      { id: "1", name: "Drake Hotline Bling", box_count: 2 },
      { id: "2", name: "Random Thing", box_count: 2 },
    ];
    expect(curateTemplates(memes, ["drake hotline bling"])).toEqual([{ id: "1", name: "Drake Hotline Bling", boxCount: 2 }]);
  });
});
