import { describe, expect, it, vi } from "vitest";

vi.mock("@google/generative-ai", () => {
  const generateContent = vi.fn(async () => ({
    response: { text: () => `{"remainingMl":770,"consumedMl":730,"redLineYRatio":0.57,"confidence":0.9}` },
  }));
  return {
    GoogleGenerativeAI: vi.fn(() => ({ getGenerativeModel: vi.fn(() => ({ generateContent })) })),
    SchemaType: { OBJECT: "OBJECT", NUMBER: "NUMBER" },
  };
});

import { callGemini } from "../src/llm/gemini.js";

describe("callGemini", () => {
  it("returns raw text from SDK", async () => {
    const text = await callGemini({
      apiKey: "test", modelId: "gemini-2.5-flash",
      systemText: "sys", userText: "user", fewShots: [], imageBase64: "abc",
    });
    expect(text).toContain("770");
  });
});
