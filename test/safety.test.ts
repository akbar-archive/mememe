import { describe, expect, it } from "vitest";
import { isBlocked } from "../src/safety";

describe("isBlocked", () => {
  it("blocks titles containing a blocklisted word", () => {
    expect(isBlocked("Three dead after factory fire")).toBe(true);
    expect(isBlocked("WAR in the streets")).toBe(true);
  });

  it("matches whole words only", () => {
    expect(isBlocked("Warner Bros launches streaming bundle")).toBe(false);
    expect(isBlocked("Software update kills battery life")).toBe(true);
  });

  it("lets ordinary tech news through", () => {
    expect(isBlocked("Apple charges $999 for a monitor stand again")).toBe(false);
  });
});
