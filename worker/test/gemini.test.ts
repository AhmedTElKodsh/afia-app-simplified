import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { callGemini } from "../src/llm/gemini.js";

const successBody = {
  candidates: [
    {
      content: {
        parts: [
          { text: `{"remainingMl":770,"consumedMl":730,"redLineYRatio":0.57,"confidence":0.9}` },
        ],
      },
    },
  ],
};

function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status: init.status ?? 200,
    headers: { "content-type": "application/json", ...init.headers },
  });
}

describe("callGemini", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    fetchMock.mockResolvedValue(jsonResponse(successBody));
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("returns raw text from direct Gemini fetch and configures request shape", async () => {
    const text = await callGemini({
      apiKey: "test",
      modelId: "gemini-2.5-flash",
      systemText: "sys",
      userText: "user",
      fewShots: [],
      imageBase64: "abc",
    });

    expect(text).toContain("770");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("/v1beta/models/gemini-2.5-flash:generateContent?key=test");
    expect(init.method).toBe("POST");
    const body = JSON.parse(String(init.body));
    expect(body.systemInstruction.parts[0].text).toBe("sys");
    expect(body.generationConfig).toEqual({ temperature: 0, maxOutputTokens: 4096 });
    expect(body.contents[0].parts.at(-1).text).toContain("user");
    expect(body.contents[0].parts.at(-1).text).toContain("Return exactly one JSON object");
  });

  it("retries 429 quota responses using server-provided retry delay", async () => {
    vi.useFakeTimers();
    fetchMock
      .mockResolvedValueOnce(new Response("Too Many Requests. Please retry in 0.01s.", { status: 429 }))
      .mockResolvedValueOnce(jsonResponse(successBody));

    const promise = callGemini({
      apiKey: "test",
      modelId: "gemini-2.5-flash",
      systemText: "sys",
      userText: "user",
      fewShots: [],
      imageBase64: "abc",
    });

    await vi.advanceTimersByTimeAsync(1010);
    const text = await promise;

    expect(text).toContain("770");
    expect(fetchMock).toHaveBeenCalledTimes(2);
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

    const [, init] = fetchMock.mock.calls.at(-1) as [string, RequestInit];
    const body = JSON.parse(String(init.body));
    const parts = body.contents[0].parts as Array<{ text?: string; inline_data?: { data: string } }>;
    expect(parts.slice(0, 3).map((part) => part.inline_data?.data)).toEqual(["ref-full", "ref-empty", "target"]);
    expect(parts.at(-1)?.text).toContain("Reference A: full 1500ml");
    expect(parts.at(-1)?.text).toContain("user");
    expect(parts.at(-1)?.text).toContain("Return exactly one JSON object");
  });
});
