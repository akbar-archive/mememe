import { GoogleGenAI } from "@google/genai";
import type { JsonModel } from "./types";

// Without a timeout an overloaded model can hang the call for minutes, past the job limit.
// 90s: scoring ~40 headlines took 20-45s+ when Gemini was busy; 4 calls x 90s still fits the 10 min job.
const REQUEST_TIMEOUT_MS = 90_000;

/** JsonModel backed by Gemini's JSON response mode. */
export class GeminiJsonModel implements JsonModel {
  private readonly client: GoogleGenAI;

  constructor(apiKey: string, private readonly modelName: string) {
    this.client = new GoogleGenAI({ apiKey });
  }

  async generateJson(prompt: string): Promise<unknown> {
    const response = await this.client.models.generateContent({
      model: this.modelName,
      contents: prompt,
      config: { responseMimeType: "application/json", abortSignal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) },
    });
    if (!response.text) throw new Error("empty Gemini response");
    return JSON.parse(response.text);
  }
}
