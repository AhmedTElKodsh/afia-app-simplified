import { afterEach, describe, expect, it, vi } from "vitest";
import { callOpenRouter, isOpenRouterVisionModel } from "../src/llm/openrouter.js";

describe("OpenRouter vision model allowlist", () => {
  it("allows explicit free vision-capable model ids", () => {
    expect(isOpenRouterVisionModel("google/gemma-4-31b-it:free")).toBe(true);
    expect(isOpenRouterVisionModel("nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free")).toBe(true);
    expect(isOpenRouterVisionModel("nvidia/nemotron-nano-12b-v2-vl:free")).toBe(true);
  });

  it("rejects text-only free model ids", () => {
    expect(isOpenRouterVisionModel("meta-llama/llama-3.2-3b-instruct:free")).toBe(false);
  });

  it("requests strict visual evidence JSON schema from OpenRouter", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({
      choices: [{ message: { content: "{\"schemaVersion\":\"afia_visual_evidence_v1\"}" } }],
    }), { status: 200 }));

    await callOpenRouter({
      apiKey: "or-test",
      modelId: "google/gemma-4-31b-it:free",
      systemText: "system",
      userText: "user",
      imageBase64: "abc",
      fetchImpl: fetchMock,
    });

    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    const body = JSON.parse(String(init.body));
    const userMessage = body.messages[1];
    expect(userMessage.content.at(-1).text).toContain("The target image is the final image");
    expect(body.response_format).toMatchObject({
      type: "json_schema",
      json_schema: {
        name: "afia_visual_evidence_v1",
        strict: true,
        schema: expect.objectContaining({
          type: "object",
          required: expect.arrayContaining(["schemaVersion", "bottleBox", "liquidLine"]),
          properties: expect.objectContaining({
            schemaVersion: expect.objectContaining({ const: "afia_visual_evidence_v1" }),
            bottleType: expect.objectContaining({ enum: ["afia_1_5l", "afia_2_5l", "unknown"] }),
          }),
        }),
      },
    });
  });

  it("includes optional reference images and coordinate calibration text", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({
      choices: [{ message: { content: "{\"schemaVersion\":\"afia_visual_evidence_v1\"}" } }],
    }), { status: 200 }));

    await callOpenRouter({
      apiKey: "or-test",
      modelId: "google/gemma-4-31b-it:free",
      systemText: "system",
      userText: "user",
      fewShots: [
        {
          imagePath: "ref.jpg",
          expected: {
            readingPossible: true,
            meniscusVisible: "yes",
            oilSurfaceYRatio: 0.56,
            nearestReferenceMl: 770,
            qualityFlags: [],
            confidence: 0.9,
          },
        },
      ],
      referenceImages: [{ label: "mid 770ml", mimeType: "image/jpeg", data: "ref-data" }],
      imageBase64: "target-data",
      fetchImpl: fetchMock,
    });

    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    const body = JSON.parse(String(init.body));
    const content = body.messages[1].content;
    expect(content[0].image_url.url).toBe("data:image/jpeg;base64,ref-data");
    expect(content[1].image_url.url).toBe("data:image/jpeg;base64,target-data");
    expect(content[2].text).toContain("known remaining 770ml");
    expect(content[2].text).toContain("expected oil surface y=560/1000");
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});
