import { describe, expect, it, vi } from "vitest";
import { callGrok } from "../src/llm/grok.js";

describe("callGrok", () => {
  it("calls xAI chat completions with image input and returns assistant content", async () => {
    const fetchImpl = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => new Response(JSON.stringify({
      choices: [{ message: { content: "{\"readingPossible\":true}" } }],
    }), { status: 200 }));

    const result = await callGrok({
      apiKey: "xai-secret",
      modelId: "grok-test",
      systemText: "system",
      userText: "user",
      imageBase64: "abc",
      targetMimeType: "image/png",
      fetchImpl,
    });

    expect(result).toBe("{\"readingPossible\":true}");
    expect(fetchImpl).toHaveBeenCalledWith(
      "https://api.x.ai/v1/chat/completions",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ authorization: "Bearer xai-secret" }),
      }),
    );
    const [, init] = fetchImpl.mock.calls[0] as [RequestInfo | URL, RequestInit];
    const body = JSON.parse(init.body as string);
    expect(body).toMatchObject({
      model: "grok-test",
      response_format: { type: "json_object" },
    });
    expect(body.messages[1].content[1].image_url.url).toBe("data:image/png;base64,abc");
  });

  it("throws on non-2xx responses", async () => {
    await expect(callGrok({
      apiKey: "xai-secret",
      modelId: "grok-test",
      systemText: "system",
      userText: "user",
      imageBase64: "abc",
      fetchImpl: async () => new Response("bad", { status: 429 }),
    })).rejects.toThrow(/Grok API failed/);
  });
});
