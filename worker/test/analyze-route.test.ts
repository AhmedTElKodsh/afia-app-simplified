import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  callGemini: vi.fn(async () => JSON.stringify({
    readingPossible: true,
    meniscusVisible: "yes",
    oilSurfaceYRatio: 0.42,
    nearestReferenceMl: 900,
    fillPercent: 60,
    qualityFlags: ["mild_glare"],
    confidence: 0.8,
  })),
  callGrok: vi.fn(async () => JSON.stringify({
    readingPossible: true,
    meniscusVisible: "yes",
    oilSurfaceYRatio: 0.6,
    nearestReferenceMl: 600,
    fillPercent: 40,
    qualityFlags: ["low_confidence"],
    confidence: 0.62,
  })),
  saveAnalysis: vi.fn(async () => ({ id: "0d44aecc-8344-44c8-8b7f-201216f7c9f9" })),
}));

vi.mock("../src/llm/gemini.js", () => ({ callGemini: mocks.callGemini }));
vi.mock("../src/llm/grok.js", () => ({ callGrok: mocks.callGrok }));
vi.mock("../src/storage/supabase.js", () => ({
  createAnalysisStorage: vi.fn(() => ({ saveAnalysis: mocks.saveAnalysis })),
}));

import app from "../src/index.js";

describe("POST /api/analyze", () => {
  beforeEach(() => {
    mocks.callGemini.mockClear();
    mocks.callGemini.mockResolvedValue(JSON.stringify({
      readingPossible: true,
      meniscusVisible: "yes",
      oilSurfaceYRatio: 0.42,
      nearestReferenceMl: 900,
      fillPercent: 60,
      qualityFlags: ["mild_glare"],
      confidence: 0.8,
    }));
    mocks.callGrok.mockClear();
    mocks.callGrok.mockResolvedValue(JSON.stringify({
      readingPossible: true,
      meniscusVisible: "yes",
      oilSurfaceYRatio: 0.6,
      nearestReferenceMl: 600,
      fillPercent: 40,
      qualityFlags: ["low_confidence"],
      confidence: 0.62,
    }));
    mocks.saveAnalysis.mockClear();
    mocks.saveAnalysis.mockResolvedValue({ id: "0d44aecc-8344-44c8-8b7f-201216f7c9f9" });
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
      remainingMl: 900,
      consumedMl: 600,
      redLineYRatio: 0.42,
      confidence: 0.8,
      warnings: ["mild_glare"],
      provider: "gemini",
      rawMetadata: { modelId: "gemini-test", promptVersion: "v1" },
    });
    expect(mocks.callGemini).toHaveBeenCalledWith(expect.objectContaining({
      apiKey: "first-key",
      imageBase64: "abc",
      targetMimeType: "image/png",
    }));
    expect(mocks.saveAnalysis).toHaveBeenCalledWith(expect.objectContaining({
      bottleSize: "1.5L",
      imageBase64: "data:image/png;base64,abc",
      result: expect.objectContaining({ provider: "gemini" }),
    }));
  });

  it("retries Gemini with the next rotated key when the first key fails", async () => {
    mocks.callGemini
      .mockRejectedValueOnce(new Error("quota"))
      .mockResolvedValueOnce(JSON.stringify({
        readingPossible: true,
        meniscusVisible: "yes",
        oilSurfaceYRatio: 0.5,
        nearestReferenceMl: 750,
        fillPercent: 50,
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
      remainingMl: 600,
      provider: "grok",
      rawMetadata: {
        modelId: "grok-test",
        fallbackReason: "gemini_failed",
      },
    });
    expect(mocks.callGrok).toHaveBeenCalledWith(expect.objectContaining({
      apiKey: "grok-secret",
      imageBase64: "abc",
    }));
    expect(mocks.saveAnalysis).toHaveBeenCalledWith(expect.objectContaining({
      result: expect.objectContaining({ provider: "grok" }),
    }));
  });
});
