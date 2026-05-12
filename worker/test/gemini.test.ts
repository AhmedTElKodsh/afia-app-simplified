import { describe, expect, it, vi } from "vitest";

const generateContent = vi.fn(async () => ({
  response: { text: () => `{"remainingMl":770,"consumedMl":730,"redLineYRatio":0.57,"confidence":0.9}` },
}));
const getGenerativeModel = vi.fn(() => ({ generateContent }));

vi.mock("@google/generative-ai", () => {
  return {
    GoogleGenerativeAI: vi.fn(() => ({ getGenerativeModel })),
    SchemaType: { ARRAY: "ARRAY", BOOLEAN: "BOOLEAN", NUMBER: "NUMBER", OBJECT: "OBJECT", STRING: "STRING" },
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

  it("sends reference/target image parts before the final instruction text", async () => {
    await callGemini({
      apiKey: "test",
      modelId: "gemini-2.5-flash",
      systemText: "sys",
      userText: "user",
      fewShots: [],
      imageBase64: "target",
      referenceImages: [
        { label: "Reference A: full 1500ml", mimeType: "image/jpeg", data: "ref-full" },
        { label: "Reference B: empty 0ml", mimeType: "image/jpeg", data: "ref-empty" },
      ],
    });

    const lastCall = generateContent.mock.calls.at(-1) as unknown as [Array<{ text?: string; inlineData?: { data: string } }>];
    const parts = lastCall[0];
    expect(parts.slice(0, 3).map((part) => part.inlineData?.data)).toEqual(["ref-full", "ref-empty", "target"]);
    expect(parts.at(-1)?.text).toContain("Reference A: full 1500ml");
    expect(parts.at(-1)?.text).toContain("user");
  });
});
