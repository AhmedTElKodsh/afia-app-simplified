import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  type StoredRecord = {
    id: string;
    createdAt: string;
    bottleSize: "1.5L";
    imageUrl: string;
    remainingMl: number;
    consumedMl: number;
    redLineYRatio: number;
    confidence: number;
    warnings: string[];
    provider: "gemini" | "grok";
    promptVersion: string;
    modelId: string;
    rawModelText: string;
    correctionStatus: "pending_review" | "manual_corrected";
    adminFlag: string | null;
    adminCorrectedMl: number | null;
    adminNote: string | null;
  };

  const records: StoredRecord[] = [];

  return {
    records,
    callGemini: vi.fn(async () => JSON.stringify({
      readingPossible: true,
      meniscusVisible: "yes",
      oilSurfaceYRatio: 0.42,
      nearestReferenceMl: 900,
      qualityFlags: ["mild_glare"],
      confidence: 0.8,
    })),
    callGrok: vi.fn(),
    saveAnalysis: vi.fn(async (input) => {
      const record: StoredRecord = {
        id: input.id,
        createdAt: "2026-05-10T10:00:00.000Z",
        bottleSize: input.bottleSize,
        imageUrl: `https://example.supabase.co/storage/${input.id}.jpg`,
        remainingMl: input.result.remainingMl,
        consumedMl: input.result.consumedMl,
        redLineYRatio: input.result.redLineYRatio,
        confidence: input.result.confidence,
        warnings: input.result.warnings,
        provider: input.result.provider,
        promptVersion: input.result.rawMetadata.promptVersion,
        modelId: input.result.rawMetadata.modelId,
        rawModelText: input.result.rawMetadata.rawModelText,
        correctionStatus: "pending_review",
        adminFlag: null,
        adminCorrectedMl: null,
        adminNote: null,
      };
      records.unshift(record);
      return { id: record.id };
    }),
    listAnalyses: vi.fn(async () => records),
    updateAnalysisCorrection: vi.fn(async (id, correction) => {
      const record = records.find((item) => item.id === id);
      if (!record) throw new Error("record not found");
      Object.assign(record, correction);
      return record;
    }),
  };
});

vi.mock("../src/llm/gemini.js", () => ({ callGemini: mocks.callGemini }));
vi.mock("../src/llm/grok.js", () => ({ callGrok: mocks.callGrok }));
vi.mock("../src/storage/supabase.js", () => ({
  createAnalysisStorage: vi.fn(() => ({
    saveAnalysis: mocks.saveAnalysis,
    listAnalyses: mocks.listAnalyses,
    updateAnalysisCorrection: mocks.updateAnalysisCorrection,
  })),
}));

import app from "../src/index.js";

describe("Stage 1 analyze to admin review flow", () => {
  beforeEach(() => {
    mocks.records.length = 0;
    mocks.callGemini.mockClear();
    mocks.callGrok.mockClear();
    mocks.saveAnalysis.mockClear();
    mocks.listAnalyses.mockClear();
    mocks.updateAnalysisCorrection.mockClear();
  });

  it("persists an analyzed 1.5L capture and exposes it for admin correction", async () => {
    const env = {
      ADMIN_TOKEN: "secret",
      GEMINI_API_KEY: "gemini",
      MODEL_ID: "gemini-test",
      SUPABASE_URL: "https://example.supabase.co",
      SUPABASE_SERVICE_ROLE_KEY: "service-role",
    };

    const analyze = await app.request(
      "/api/analyze",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          bottleSize: "1.5L",
          imageBase64: "data:image/jpeg;base64,captured-frame",
        }),
      },
      env,
    );
    const analyzeBody = await analyze.json();

    expect(analyze.status).toBe(200);
    expect(analyzeBody).toMatchObject({
      remainingMl: 1038,
      consumedMl: 462,
      provider: "gemini",
      analysisId: expect.any(String),
    });

    const queue = await app.request(
      "/api/admin/analyses?limit=20",
      { headers: { authorization: "Bearer secret" } },
      env,
    );
    const queueBody = await queue.json();

    expect(queue.status).toBe(200);
    expect(queueBody.analyses).toHaveLength(1);
    expect(queueBody.analyses[0]).toMatchObject({
      id: analyzeBody.analysisId,
      remainingMl: 1038,
      correctionStatus: "pending_review",
    });

    const correction = await app.request(
      `/api/admin/analyses/${analyzeBody.analysisId}`,
      {
        method: "PATCH",
        headers: { authorization: "Bearer secret", "content-type": "application/json" },
        body: JSON.stringify({
          correctionStatus: "manual_corrected",
          adminFlag: "too_big",
          adminCorrectedMl: 825,
          adminNote: "Adjusted after visual review",
        }),
      },
      env,
    );
    const correctionBody = await correction.json();

    expect(correction.status).toBe(200);
    expect(correctionBody.analysis).toMatchObject({
      id: analyzeBody.analysisId,
      correctionStatus: "manual_corrected",
      adminFlag: "too_big",
      adminCorrectedMl: 825,
      adminNote: "Adjusted after visual review",
    });
  });
});
