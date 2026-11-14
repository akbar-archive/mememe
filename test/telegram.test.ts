import { describe, expect, it, vi } from "vitest";
import { TelegramPublisher } from "../src/telegram";

describe("TelegramPublisher", () => {
  it("sends the photo with caption to the channel", async () => {
    const fetchFn = vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true })));
    await new TelegramPublisher("TOKEN", "@chan", fetchFn).publish("https://img", "hello");

    const [url, init] = fetchFn.mock.calls[0]!;
    expect(url).toBe("https://api.telegram.org/botTOKEN/sendPhoto");
    expect(JSON.parse(init.body)).toEqual({ chat_id: "@chan", photo: "https://img", caption: "hello" });
  });

  it("throws Telegram's description when not ok", async () => {
    const fetchFn = vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: false, description: "chat not found" }), { status: 400 }));
    await expect(new TelegramPublisher("T", "@c", fetchFn).publish("u", "c")).rejects.toThrow("chat not found");
  });
});

describe("TelegramPublisher caption limit", () => {
  it("truncates captions to Telegram's 1024-char photo limit", async () => {
    const fetchFn = vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true })));
    await new TelegramPublisher("T", "@c", fetchFn).publish("u", "x".repeat(2000));
    expect(JSON.parse(fetchFn.mock.calls[0]![1].body).caption).toHaveLength(1024);
  });
});
