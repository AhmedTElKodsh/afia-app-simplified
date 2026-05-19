import { describe, expect, it, vi, beforeEach } from "vitest";
import app from "../src/index.js";
import { runPipeline } from "../src/cv/pipeline.js";

vi.mock("../src/cv/pipeline.js", () => ({
  runPipeline: vi.fn(),
  ratioToCategory: vi.fn((ratio: number) => {
    if (ratio < 0.125) return "Empty";
    if (ratio < 0.375) return "Quarter";
    if (ratio < 0.625) return "Half";
    if (ratio < 0.875) return "Three Quarter";
    return "Full";
  }),
}));

describe("POST /api/cv-analyze integration", () => {
  const validImage = "data:image/jpeg;base64," + btoa("dummy-image-data");

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 400 if imageBase64 is missing", async () => {
    const res = await app.request("/api/cv-analyze", {
      method: "POST",
      body: JSON.stringify({}),
      headers: { "Content-Type": "application/json" },
    });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "imageBase64 is required" });
  });

  it("returns 400 for unsupported MIME type", async () => {
    const res = await app.request("/api/cv-analyze", {
      method: "POST",
      body: JSON.stringify({ imageBase64: "data:image/webp;base64,..." }),
      headers: { "Content-Type": "application/json" },
    });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "Unsupported image format. Use JPEG or PNG." });
  });

  it("returns 413 for oversized image", async () => {
    // 10MB limit. Base64 is ~33% larger than raw.
    // To exceed 10MB decoded, we need > 13.3MB base64.
    const largeData = "A".repeat(15 * 1024 * 1024); 
    const res = await app.request("/api/cv-analyze", {
      method: "POST",
      body: JSON.stringify({ imageBase64: "data:image/jpeg;base64," + largeData }),
      headers: { "Content-Type": "application/json" },
    });
    expect(res.status).toBe(413);
    const json = await res.json() as any;
    expect(json.error).toContain("Image too large");
  });

  it("successfully analyzes a valid image and forwards LLM signals", async () => {
    const mockOutput = {
      success: true,
      fillRatio: 0.5,
      category: "Half",
      confidence: 0.9,
      tier: "high",
      errors: [],
      diagnostics: {
        contourFound: true,
        meniscusY: 100,
        edgeStrength: 1500,
        stages: ["validate", "preprocess", "contour", "fusion"],
        fusion: {
           source: "fusion",
           confidence: 0.9,
           score: 0.5,
           remainingMl: 750,
           features: { llmSignalProvided: 1 }
        }
      },
    };
    (runPipeline as any).mockResolvedValue(mockOutput);

    const res = await app.request("/api/cv-analyze", {
      method: "POST",
      body: JSON.stringify({
        imageBase64: validImage,
        bottleSizeMl: 1500,
        llmRemainingMl: 700,
        llmConfidence: 0.8
      }),
      headers: { "Content-Type": "application/json" },
    }, { GEMINI_API_KEY: "test-key" });

    expect(res.status).toBe(200);
    const json = await res.json() as any;
    expect(json.remainingMl).toBe(750);
    expect(json.category).toBe("Half");
    expect(json.tier).toBe("high");
    expect(json.provider).toBe("cv_llm");
    expect(json.diagnostics.fusion.features.llmSignalProvided).toBe(1);

    expect(runPipeline).toHaveBeenCalledWith(expect.objectContaining({
      bottleSizeMl: 1500,
      llmRemainingMl: 700,
      llmConfidence: 0.8,
      geminiApiKey: "test-key"
    }));
  });

  it("returns provider: 'cv' when no LLM signals are provided", async () => {
    const mockOutput = {
      success: true,
      fillRatio: 0.5,
      category: "Half",
      confidence: 0.7,
      tier: "medium",
      errors: [],
      diagnostics: { stages: ["cv-only"] },
    };
    (runPipeline as any).mockResolvedValue(mockOutput);

    const res = await app.request("/api/cv-analyze", {
      method: "POST",
      body: JSON.stringify({
        imageBase64: validImage,
      }),
      headers: { "Content-Type": "application/json" },
    }, { GEMINI_API_KEY: "test-key" });

    expect(res.status).toBe(200);
    const json = await res.json() as any;
    expect(json.provider).toBe("cv");
  });

  it("returns 400 for invalid bottleSizeMl", async () => {
    const res = await app.request("/api/cv-analyze", {
      method: "POST",
      body: JSON.stringify({ 
        imageBase64: validImage,
        bottleSizeMl: -100
      }),
      headers: { "Content-Type": "application/json" },
    }, { GEMINI_API_KEY: "test-key" });

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "Invalid bottleSizeMl" });
  });

  it("returns 400 instead of silently defaulting malformed bottleSizeMl", async () => {
    const res = await app.request("/api/cv-analyze", {
      method: "POST",
      body: JSON.stringify({
        imageBase64: validImage,
        bottleSizeMl: "bad",
      }),
      headers: { "Content-Type": "application/json" },
    }, { GEMINI_API_KEY: "test-key" });

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "Invalid bottleSizeMl" });
    expect(runPipeline).not.toHaveBeenCalled();
  });

  it("returns 422 for unsupported bottle sizes before running CV", async () => {
    const res = await app.request("/api/cv-analyze", {
      method: "POST",
      body: JSON.stringify({
        imageBase64: validImage,
        bottleSizeMl: 2500,
      }),
      headers: { "Content-Type": "application/json" },
    }, { GEMINI_API_KEY: "test-key" });

    expect(res.status).toBe(422);
    expect(await res.json()).toEqual({ error: "Unsupported bottleSizeMl. Stage 1 CV supports 1500ml only." });
    expect(runPipeline).not.toHaveBeenCalled();
  });

  it("returns 500 when pipeline throws", async () => {
    (runPipeline as any).mockRejectedValue(new Error("Internal error"));

    const res = await app.request("/api/cv-analyze", {
      method: "POST",
      body: JSON.stringify({ imageBase64: validImage }),
      headers: { "Content-Type": "application/json" },
    }, { GEMINI_API_KEY: "test-key" });

    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "CV analysis failed" });
  });
});
