import { describe, expect, it } from "vitest";
import { buildGeminiKeyPool, buildGrokKeyPool, buildOpenRouterKeyPool, selectGeminiKey } from "../src/llm/rotation.js";

describe("Gemini key rotation", () => {
  it("builds a stable ordered pool from pooled and numbered env keys", () => {
    expect(buildGeminiKeyPool({
      GEMINI_API_KEY: "primary",
      GEMINI_API_KEYS: " pooled-a, pooled-b ",
      GEMINI_API_KEYS2: "pooled-c",
      GEMINI_API_KEYS3: "pooled-d",
      GEMINI_API_KEYS4: "pooled-e",
      GEMINI_API_KEY2: "second",
      GEMINI_API_KEY3: "third",
      GEMINI_API_KEY4: "fourth",
      MODEL_ID: "gemini-test",
    })).toEqual(["pooled-a", "pooled-b", "pooled-c", "pooled-d", "pooled-e", "primary", "second", "third", "fourth"]);
  });

  it("removes duplicate and empty keys", () => {
    expect(buildGeminiKeyPool({
      GEMINI_API_KEY: "primary",
      GEMINI_API_KEYS: "primary,, second",
      GEMINI_API_KEY2: "second",
      MODEL_ID: "gemini-test",
    })).toEqual(["primary", "second"]);
  });

  it("selects keys round-robin by attempt", () => {
    const keys = ["a", "b", "c"];

    expect(selectGeminiKey(keys, 0)).toBe("a");
    expect(selectGeminiKey(keys, 1)).toBe("b");
    expect(selectGeminiKey(keys, 3)).toBe("a");
  });

  it("builds OpenRouter and Grok pools from pooled and numbered env keys", () => {
    expect(buildOpenRouterKeyPool({
      GEMINI_API_KEY: "unused",
      MODEL_ID: "gemini-test",
      OPENROUTER_API_KEYS: " or-a, or-b ",
      OPENROUTER_API_KEY: "or-main",
      OPENROUTER_API_KEY2: "or-b",
      OPENROUTER_API_KEY3: "or-c",
    })).toEqual(["or-a", "or-b", "or-main", "or-c"]);

    expect(buildGrokKeyPool({
      GEMINI_API_KEY: "unused",
      MODEL_ID: "gemini-test",
      GROK_API_KEYS: " grok-a, grok-b ",
      GROK_API_KEY: "grok-main",
      GROK_API_KEY2: "grok-b",
    })).toEqual(["grok-a", "grok-b", "grok-main"]);
  });
});
