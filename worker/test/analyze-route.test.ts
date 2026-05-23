import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  callGemini: vi.fn(async () => JSON.stringify({
    readingPossible: true,
    meniscusVisible: "yes",
    oilSurfaceYRatio: 0.42,
    nearestReferenceMl: 900,
    qualityFlags: ["mild_glare"],
    confidence: 0.8,
  })),
  callGrok: vi.fn(async () => JSON.stringify({
    readingPossible: true,
    meniscusVisible: "yes",
    oilSurfaceYRatio: 0.6,
    nearestReferenceMl: 600,
    qualityFlags: ["low_confidence"],
    confidence: 0.62,
  })),
  saveAnalysis: vi.fn(async () => ({ id: "0d44aecc-8344-44c8-8b7f-201216f7c9f9" })),
  loadPrompt: vi.fn(async () => ({
    systemText: "Mock system instruction for Afia bottle",
    userText: "Mock user instruction",
    fewShots: [{ expected: { nearestReferenceMl: 750 } }],
    promptHash: "a1b2c3d4e5f6g7h8",
    fewshotHash: "h8g7f6e5d4c3b2a1",
    promptVersion: "v1",
    fewShotManifest: [{ path: "mid-770.json", role: "anchor", remainingMl: 770 }],
  })),
}));

vi.mock("../src/llm/gemini.js", () => ({ callGemini: mocks.callGemini }));
vi.mock("../src/llm/grok.js", () => ({ callGrok: mocks.callGrok }));
vi.mock("../src/prompt/load.js", () => ({ loadPrompt: mocks.loadPrompt }));
vi.mock("../src/storage/supabase.js", () => ({
  createAnalysisStorage: vi.fn(() => ({ saveAnalysis: mocks.saveAnalysis })),
}));

import app from "../src/index.js";

const openRouterEvidence = JSON.stringify({
  readingPossible: true,
  meniscusVisible: "yes",
  oilSurfaceYRatio: 0.55,
  nearestReferenceMl: 825,
  qualityFlags: ["openrouter_review"],
  confidence: 0.72,
});

describe("POST /api/analyze", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn(async () => ({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: openRouterEvidence } }],
      }),
      text: async () => "",
    })));
    mocks.callGemini.mockClear();
    mocks.callGemini.mockResolvedValue(JSON.stringify({
      readingPossible: true,
      meniscusVisible: "yes",
      oilSurfaceYRatio: 0.42,
      nearestReferenceMl: 900,
      qualityFlags: ["mild_glare"],
      confidence: 0.8,
    }));
    mocks.callGrok.mockClear();
    mocks.callGrok.mockResolvedValue(JSON.stringify({
      readingPossible: true,
      meniscusVisible: "yes",
      oilSurfaceYRatio: 0.6,
      nearestReferenceMl: 600,
      qualityFlags: ["low_confidence"],
      confidence: 0.62,
    }));
    mocks.saveAnalysis.mockClear();
    mocks.saveAnalysis.mockResolvedValue({ id: "0d44aecc-8344-44c8-8b7f-201216f7c9f9" });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("rejects invalid request bodies", async () => {
    const res = await app.request("/api/analyze", { method: "POST", body: "{}" });

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toMatchObject({ error: "Invalid analyze request" });
  });

  it("rejects unsupported bottle sizes", async () => {
    const res = await app.request("/api/analyze", {
      method: "POST",
      body: JSON.stringify({ bottleSize: "2.5L", imageBase64: "abc" }),
      headers: { "content-type": "application/json" },
    });

    expect(res.status).toBe(422);
    await expect(res.json()).resolves.toMatchObject({ error: "Unsupported bottle size", supportedBottleSize: "1.5L" });
  });

  it("returns a parsed Gemini analysis result for 1.5L images", async () => {
    const res = await app.request(
      "/api/analyze",
      {
        method: "POST",
        body: JSON.stringify({ bottleSize: "1.5L", imageBase64: "data:image/png;base64,abc" }),
        headers: { "content-type": "application/json" },
      },
      {
        GEMINI_API_KEY: "fallback-primary",
        GEMINI_API_KEYS: "first-key,second-key",
        MODEL_ID: "gemini-test",
        SUPABASE_URL: "https://example.supabase.co",
        SUPABASE_SERVICE_ROLE_KEY: "secret",
      },
    );

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({
      remainingMl: 1038,
      consumedMl: 462,
      redLineYRatio: 0.42,
      confidence: 0.8,
      warnings: ["mild_glare"],
      provider: "gemini",
      rawMetadata: expect.objectContaining({
        modelId: "gemini-test",
        promptVersion: "v1",
        promptHash: "a1b2c3d4e5f6g7h8",
        fewshotHash: "h8g7f6e5d4c3b2a1",
      }),
    });
    expect(mocks.callGemini).toHaveBeenCalledWith(expect.objectContaining({
      apiKey: "first-key",
      imageBase64: "abc",
      targetMimeType: "image/png",
      systemText: "Mock system instruction for Afia bottle",
      fewShots: expect.arrayContaining([expect.anything()]),
    }));
    expect(mocks.saveAnalysis).toHaveBeenCalledWith(expect.objectContaining({
      bottleSize: "1.5L",
      imageBase64: "data:image/png;base64,abc",
      result: expect.objectContaining({ provider: "gemini" }),
    }));
  });

  it("computes the result from Gemini visual evidence coordinates", async () => {
    mocks.callGemini.mockResolvedValueOnce(JSON.stringify({
      schemaVersion: "afia_visual_evidence_v1",
      bottleDetected: true,
      bottleType: "afia_1_5l",
      bottleTypeConfidence: 0.91,
      topVisible: true,
      bottomVisible: true,
      frontLabelVisible: true,
      liquidBoundaryVisible: true,
      bottleBox: { yMin: 100, xMin: 250, yMax: 900, xMax: 750 },
      liquidLine: { kind: "line", points: [{ x: 300, y: 500 }, { x: 700, y: 500 }] },
      qualityFlags: ["mild_glare"],
      evidenceConfidence: 0.82,
      refusalReason: null,
    }));

    const res = await app.request(
      "/api/analyze",
      {
        method: "POST",
        body: JSON.stringify({ bottleSize: "1.5L", imageBase64: "data:image/png;base64,abc" }),
        headers: { "content-type": "application/json" },
      },
      {
        GEMINI_API_KEY: "primary",
        MODEL_ID: "gemini-test",
        SUPABASE_URL: "https://example.supabase.co",
        SUPABASE_SERVICE_ROLE_KEY: "secret",
      },
    );

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({
      remainingMl: 711,
      consumedMl: 789,
      redLineYRatio: 0.5,
      confidence: 0.82,
      warnings: ["mild_glare"],
      provider: "gemini",
      rawMetadata: expect.objectContaining({
        rawModelText: expect.stringContaining("afia_visual_evidence_v1"),
      }),
    });
    expect(mocks.saveAnalysis).toHaveBeenCalledWith(expect.objectContaining({
      result: expect.objectContaining({ remainingMl: 711, consumedMl: 789 }),
    }));
  });

  it("uses OpenRouter when no Gemini key is configured", async () => {
    const res = await app.request(
      "/api/analyze",
      {
        method: "POST",
        body: JSON.stringify({ bottleSize: "1.5L", imageBase64: "data:image/jpeg;base64,abc" }),
        headers: { "content-type": "application/json" },
      },
      {
        OPENROUTER_API_KEY: "or-secret",
        OPENROUTER_MODEL_ID: "meta-llama/llama-3.2-11b-vision-instruct",
        MODEL_ID: "gemini-test",
        SUPABASE_URL: "https://example.supabase.co",
        SUPABASE_SERVICE_ROLE_KEY: "secret",
      },
    );

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({
      remainingMl: 788,
      provider: "openrouter",
      rawMetadata: expect.objectContaining({
        modelId: "meta-llama/llama-3.2-11b-vision-instruct",
        fallbackReason: "gemini_unconfigured",
      }),
    });
    expect(fetch).toHaveBeenCalledWith("https://openrouter.ai/api/v1/chat/completions", expect.objectContaining({
      method: "POST",
      headers: expect.objectContaining({ authorization: "Bearer or-secret" }),
    }));
    expect(mocks.callGemini).not.toHaveBeenCalled();
    expect(mocks.callGrok).not.toHaveBeenCalled();
  });

  it("retries Gemini with the next rotated key when the first key fails", async () => {
    mocks.callGemini
      .mockRejectedValueOnce(new Error("quota"))
      .mockResolvedValueOnce(JSON.stringify({
        readingPossible: true,
        meniscusVisible: "yes",
        oilSurfaceYRatio: 0.5,
        nearestReferenceMl: 750,
        qualityFlags: [],
        confidence: 0.7,
      }));

    const res = await app.request(
      "/api/analyze",
      {
        method: "POST",
        body: JSON.stringify({ bottleSize: "1.5L", imageBase64: "abc" }),
        headers: { "content-type": "application/json" },
      },
      {
        GEMINI_API_KEY: "primary",
        GEMINI_API_KEY2: "secondary",
        MODEL_ID: "gemini-test",
        SUPABASE_URL: "https://example.supabase.co",
        SUPABASE_SERVICE_ROLE_KEY: "secret",
      },
    );

    expect(res.status).toBe(200);
    expect(mocks.callGemini).toHaveBeenNthCalledWith(1, expect.objectContaining({ apiKey: "primary" }));
    expect(mocks.callGemini).toHaveBeenNthCalledWith(2, expect.objectContaining({ apiKey: "secondary" }));
  });

  it("tries every configured Gemini key before falling back", async () => {
    mocks.callGemini
      .mockRejectedValueOnce(new Error("invalid first"))
      .mockRejectedValueOnce(new Error("invalid second"))
      .mockResolvedValueOnce(JSON.stringify({
        readingPossible: true,
        meniscusVisible: "yes",
        oilSurfaceYRatio: 0.5,
        nearestReferenceMl: 750,
        qualityFlags: [],
        confidence: 0.7,
      }));

    const res = await app.request(
      "/api/analyze",
      {
        method: "POST",
        body: JSON.stringify({ bottleSize: "1.5L", imageBase64: "abc" }),
        headers: { "content-type": "application/json" },
      },
      {
        GEMINI_API_KEYS: "bad-a,bad-b",
        GEMINI_API_KEY: "primary",
        MODEL_ID: "gemini-test",
        SUPABASE_URL: "https://example.supabase.co",
        SUPABASE_SERVICE_ROLE_KEY: "secret",
      },
    );

    expect(res.status).toBe(200);
    expect(mocks.callGemini).toHaveBeenNthCalledWith(1, expect.objectContaining({ apiKey: "bad-a" }));
    expect(mocks.callGemini).toHaveBeenNthCalledWith(2, expect.objectContaining({ apiKey: "bad-b" }));
    expect(mocks.callGemini).toHaveBeenNthCalledWith(3, expect.objectContaining({ apiKey: "primary" }));
    expect(mocks.callGrok).not.toHaveBeenCalled();
  });

  it("falls back to Grok when Gemini retries fail", async () => {
    mocks.callGemini.mockRejectedValue(new Error("quota"));

    const res = await app.request(
      "/api/analyze",
      {
        method: "POST",
        body: JSON.stringify({ bottleSize: "1.5L", imageBase64: "abc" }),
        headers: { "content-type": "application/json" },
      },
      {
        GEMINI_API_KEY: "primary",
        GEMINI_API_KEY2: "secondary",
        GROK_API_KEY: "grok-secret",
        GROK_MODEL_ID: "grok-test",
        MODEL_ID: "gemini-test",
        SUPABASE_URL: "https://example.supabase.co",
        SUPABASE_SERVICE_ROLE_KEY: "secret",
      },
    );

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({
      remainingMl: 692,
      provider: "grok",
      rawMetadata: expect.objectContaining({
        modelId: "grok-test",
        promptVersion: "v1",
        promptHash: "a1b2c3d4e5f6g7h8",
        fewshotHash: "h8g7f6e5d4c3b2a1",
        fallbackReason: "gemini_failed",
      }),
    });
    expect(mocks.callGrok).toHaveBeenCalledWith(expect.objectContaining({
      apiKey: "grok-secret",
      imageBase64: "abc",
      systemText: "Mock system instruction for Afia bottle",
    }));
    expect(mocks.saveAnalysis).toHaveBeenCalledWith(expect.objectContaining({
      result: expect.objectContaining({ provider: "grok" }),
    }));
  });

  it("falls back to OpenRouter before Grok when Gemini retries fail", async () => {
    mocks.callGemini.mockRejectedValue(new Error("quota"));

    const res = await app.request(
      "/api/analyze",
      {
        method: "POST",
        body: JSON.stringify({ bottleSize: "1.5L", imageBase64: "abc" }),
        headers: { "content-type": "application/json" },
      },
      {
        GEMINI_API_KEY: "primary",
        OPENROUTER_API_KEYS: "or-a,or-b",
        OPENROUTER_MODEL_ID: "meta-llama/llama-3.2-11b-vision-instruct",
        GROK_API_KEY: "grok-secret",
        GROK_MODEL_ID: "grok-test",
        MODEL_ID: "gemini-test",
        SUPABASE_URL: "https://example.supabase.co",
        SUPABASE_SERVICE_ROLE_KEY: "secret",
      },
    );

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({
      provider: "openrouter",
      rawMetadata: expect.objectContaining({
        modelId: "meta-llama/llama-3.2-11b-vision-instruct",
        fallbackReason: "gemini_failed",
      }),
    });
    expect(fetch).toHaveBeenCalledWith("https://openrouter.ai/api/v1/chat/completions", expect.objectContaining({
      headers: expect.objectContaining({ authorization: "Bearer or-a" }),
    }));
    expect(mocks.callGrok).not.toHaveBeenCalled();
  });

  it("rotates OpenRouter keys before falling through to Grok", async () => {
    mocks.callGemini.mockRejectedValue(new Error("quota"));
    vi.mocked(fetch)
      .mockResolvedValueOnce(new Response("rate limited", { status: 429 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        choices: [{ message: { content: openRouterEvidence } }],
      }), { status: 200 }));

    const res = await app.request(
      "/api/analyze",
      {
        method: "POST",
        body: JSON.stringify({ bottleSize: "1.5L", imageBase64: "abc" }),
        headers: { "content-type": "application/json" },
      },
      {
        GEMINI_API_KEY: "primary",
        OPENROUTER_API_KEYS: "or-a,or-b",
        OPENROUTER_MODEL_ID: "meta-llama/llama-3.2-11b-vision-instruct",
        GROK_API_KEY: "grok-secret",
        GROK_MODEL_ID: "grok-test",
        MODEL_ID: "gemini-test",
        SUPABASE_URL: "https://example.supabase.co",
        SUPABASE_SERVICE_ROLE_KEY: "secret",
      },
    );

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({ provider: "openrouter" });
    expect(fetch).toHaveBeenNthCalledWith(1, "https://openrouter.ai/api/v1/chat/completions", expect.objectContaining({
      headers: expect.objectContaining({ authorization: "Bearer or-a" }),
    }));
    expect(fetch).toHaveBeenNthCalledWith(2, "https://openrouter.ai/api/v1/chat/completions", expect.objectContaining({
      headers: expect.objectContaining({ authorization: "Bearer or-b" }),
    }));
    expect(mocks.callGrok).not.toHaveBeenCalled();
  });

  it("rotates Grok keys after earlier providers fail", async () => {
    mocks.callGemini.mockRejectedValue(new Error("quota"));
    mocks.callGrok
      .mockRejectedValueOnce(new Error("grok quota"))
      .mockResolvedValueOnce(JSON.stringify({
        readingPossible: true,
        meniscusVisible: "yes",
        oilSurfaceYRatio: 0.6,
        nearestReferenceMl: 600,
        qualityFlags: ["low_confidence"],
        confidence: 0.62,
      }));

    const res = await app.request(
      "/api/analyze",
      {
        method: "POST",
        body: JSON.stringify({ bottleSize: "1.5L", imageBase64: "abc" }),
        headers: { "content-type": "application/json" },
      },
      {
        GEMINI_API_KEY: "primary",
        GROK_API_KEYS: "grok-a,grok-b",
        GROK_MODEL_ID: "grok-test",
        MODEL_ID: "gemini-test",
        SUPABASE_URL: "https://example.supabase.co",
        SUPABASE_SERVICE_ROLE_KEY: "secret",
      },
    );

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({ provider: "grok" });
    expect(mocks.callGrok).toHaveBeenNthCalledWith(1, expect.objectContaining({ apiKey: "grok-a" }));
    expect(mocks.callGrok).toHaveBeenNthCalledWith(2, expect.objectContaining({ apiKey: "grok-b" }));
  });

  it("falls back to Grok when Gemini succeeds with low confidence", async () => {
    mocks.callGemini.mockResolvedValueOnce(JSON.stringify({
      readingPossible: true,
      meniscusVisible: "uncertain",
      oilSurfaceYRatio: 0.5,
      nearestReferenceMl: 750,
      qualityFlags: ["low_confidence"],
      confidence: 0.35,
    }));

    const res = await app.request(
      "/api/analyze",
      {
        method: "POST",
        body: JSON.stringify({ bottleSize: "1.5L", imageBase64: "abc" }),
        headers: { "content-type": "application/json" },
      },
      {
        GEMINI_API_KEY: "primary",
        GROK_API_KEY: "grok-secret",
        GROK_MODEL_ID: "grok-test",
        GROK_FALLBACK_CONFIDENCE: "0.5",
        MODEL_ID: "gemini-test",
        SUPABASE_URL: "https://example.supabase.co",
        SUPABASE_SERVICE_ROLE_KEY: "secret",
      },
    );

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({
      provider: "grok",
      rawMetadata: expect.objectContaining({
        fallbackReason: "gemini_low_confidence",
      }),
    });
    expect(mocks.callGrok).toHaveBeenCalledWith(expect.objectContaining({ apiKey: "grok-secret" }));
  });

  it("does not use OpenRouter without an explicit vision model", async () => {
    const res = await app.request(
      "/api/analyze",
      {
        method: "POST",
        body: JSON.stringify({ bottleSize: "1.5L", imageBase64: "abc" }),
        headers: { "content-type": "application/json" },
      },
      {
        OPENROUTER_API_KEY: "or-secret",
        MODEL_ID: "gemini-test",
        SUPABASE_URL: "https://example.supabase.co",
        SUPABASE_SERVICE_ROLE_KEY: "secret",
      },
    );

    expect(res.status).toBe(500);
    await expect(res.json()).resolves.toMatchObject({
      error: "No LLM vision provider key is configured",
    });
    expect(fetch).not.toHaveBeenCalled();
  });

  it("returns sanitized provider diagnostics when fallback output is malformed", async () => {
    mocks.callGemini.mockRejectedValue(new Error("quota"));
    mocks.callGrok.mockResolvedValueOnce("not-json");

    const res = await app.request(
      "/api/analyze",
      {
        method: "POST",
        body: JSON.stringify({ bottleSize: "1.5L", imageBase64: "abc" }),
        headers: { "content-type": "application/json" },
      },
      {
        GEMINI_API_KEY: "primary",
        GROK_API_KEY: "grok-secret",
        MODEL_ID: "gemini-test",
        SUPABASE_URL: "https://example.supabase.co",
        SUPABASE_SERVICE_ROLE_KEY: "secret",
      },
    );

    expect(res.status).toBe(502);
    await expect(res.json()).resolves.toMatchObject({
      error: "LLM analysis failed",
      detail: expect.objectContaining({ message: expect.any(String) }),
    });
  });

  it("returns sanitized provider diagnostics when all LLM providers fail", async () => {
    const error = new Error("Gemini API failed with 403: invalid key AIzaTESTSECRET1234567890");
    Object.assign(error, { status: 403 });
    mocks.callGemini.mockRejectedValue(error);

    const res = await app.request(
      "/api/analyze",
      {
        method: "POST",
        body: JSON.stringify({ bottleSize: "1.5L", imageBase64: "abc" }),
        headers: { "content-type": "application/json" },
      },
      {
        GEMINI_API_KEY: "primary",
        MODEL_ID: "gemini-test",
        SUPABASE_URL: "https://example.supabase.co",
        SUPABASE_SERVICE_ROLE_KEY: "secret",
      },
    );

    expect(res.status).toBe(502);
    await expect(res.json()).resolves.toEqual({
      error: "LLM analysis failed",
      detail: {
        status: 403,
        message: "Gemini API failed with 403: invalid key [redacted-google-key]",
      },
    });
  });

  it("returns sanitized persistence diagnostics when Supabase save fails", async () => {
    mocks.saveAnalysis.mockRejectedValue(new Error("Supabase image upload failed: bucket missing"));

    const res = await app.request(
      "/api/analyze",
      {
        method: "POST",
        body: JSON.stringify({ bottleSize: "1.5L", imageBase64: "abc" }),
        headers: { "content-type": "application/json" },
      },
      {
        GEMINI_API_KEY: "primary",
        MODEL_ID: "gemini-test",
        SUPABASE_URL: "https://example.supabase.co",
        SUPABASE_SERVICE_ROLE_KEY: "secret",
      },
    );

    expect(res.status).toBe(500);
    await expect(res.json()).resolves.toEqual({
      error: "Analysis persistence failed",
      detail: {
        code: "PERSISTENCE_FAILED",
        message: "Could not save analysis result",
      },
    });
  });
});
