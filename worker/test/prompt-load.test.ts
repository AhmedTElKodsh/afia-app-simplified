import { describe, expect, it } from "vitest";
import { loadPrompt } from "../src/prompt/load.js";

describe("loadPrompt", () => {
  it("returns text + stable hashes for v1", async () => {
    const { systemText, userText, fewShots, promptHash, fewshotHash } = await loadPrompt("v1");
    expect(systemText.length).toBeGreaterThan(0);
    expect(userText.length).toBeGreaterThan(0);
    expect(fewShots.length).toBeGreaterThanOrEqual(3);
    expect(promptHash).toMatch(/^[a-f0-9]{16}$/);
    expect(fewshotHash).toMatch(/^[a-f0-9]{16}$/);
  });

  it("hashes are deterministic", async () => {
    const a = await loadPrompt("v1");
    const b = await loadPrompt("v1");
    expect(a.promptHash).toBe(b.promptHash);
    expect(a.fewshotHash).toBe(b.fewshotHash);
  });
});
