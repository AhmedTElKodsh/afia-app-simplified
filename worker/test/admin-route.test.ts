import { beforeEach, describe, expect, it, vi } from "vitest";

const sampleRecord = {
  id: "0d44aecc-8344-44c8-8b7f-201216f7c9f9",
  createdAt: "2026-05-10T10:00:00.000Z",
  bottleSize: "1.5L",
  imageUrl: "https://example.com/image.jpg",
  remainingMl: 900,
  consumedMl: 600,
  redLineYRatio: 0.42,
  confidence: 0.8,
  warnings: [],
  provider: "gemini",
  promptVersion: "v1",
  modelId: "gemini-test",
  rawModelText: "{}",
  correctionStatus: "pending_review",
  adminFlag: null,
  adminCorrectedMl: null,
  adminNote: null,
};

const mocks = vi.hoisted(() => ({
  listAnalyses: vi.fn(async () => [sampleRecord]),
  updateAnalysisCorrection: vi.fn(async () => ({
    ...sampleRecord,
    correctionStatus: "manual_corrected",
    adminFlag: "too_big",
    adminCorrectedMl: 825,
    adminNote: "Adjusted",
  })),
  saveManualUpload: vi.fn(async () => ({
    ...sampleRecord,
    correctionStatus: "manual_corrected",
    adminFlag: "manual",
    adminCorrectedMl: 750,
    adminNote: "Ground truth",
  })),
}));

vi.mock("../src/storage/supabase.js", () => ({
  createAnalysisStorage: vi.fn(() => ({
    listAnalyses: mocks.listAnalyses,
    updateAnalysisCorrection: mocks.updateAnalysisCorrection,
    saveManualUpload: mocks.saveManualUpload,
  })),
}));

import app from "../src/index.js";

describe("admin routes", () => {
  beforeEach(() => {
    mocks.listAnalyses.mockClear();
    mocks.updateAnalysisCorrection.mockClear();
    mocks.saveManualUpload.mockClear();
  });

  it("requires the configured admin bearer token", async () => {
    const res = await app.request("/api/admin/analyses", {}, { ADMIN_TOKEN: "secret" });

    expect(res.status).toBe(401);
  });

  it("lists analyses for review", async () => {
    const res = await app.request(
      "/api/admin/analyses?limit=20",
      { headers: { authorization: "Bearer secret" } },
      { ADMIN_TOKEN: "secret" },
    );

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({ analyses: [sampleRecord] });
    expect(mocks.listAnalyses).toHaveBeenCalledWith({ limit: 20 });
  });

  it("updates correction fields", async () => {
    const res = await app.request(
      "/api/admin/analyses/0d44aecc-8344-44c8-8b7f-201216f7c9f9",
      {
        method: "PATCH",
        headers: { authorization: "Bearer secret", "content-type": "application/json" },
        body: JSON.stringify({
          correctionStatus: "manual_corrected",
          adminFlag: "too_big",
          adminCorrectedMl: 825,
          adminNote: "Adjusted",
        }),
      },
      { ADMIN_TOKEN: "secret" },
    );

    expect(res.status).toBe(200);
    expect(mocks.updateAnalysisCorrection).toHaveBeenCalledWith(
      "0d44aecc-8344-44c8-8b7f-201216f7c9f9",
      {
        correctionStatus: "manual_corrected",
        adminFlag: "too_big",
        adminCorrectedMl: 825,
        adminNote: "Adjusted",
      },
    );
  });

  it("saves manual uploads for ground truth ingestion", async () => {
    const res = await app.request(
      "/api/admin/upload",
      {
        method: "POST",
        headers: { authorization: "Bearer secret", "content-type": "application/json" },
        body: JSON.stringify({
          bottleSize: "1.5L",
          imageBase64: "abc",
          remainingMl: 750,
          adminNote: "Ground truth",
        }),
      },
      { ADMIN_TOKEN: "secret" },
    );

    expect(res.status).toBe(201);
    expect(mocks.saveManualUpload).toHaveBeenCalledWith(expect.objectContaining({
      bottleSize: "1.5L",
      imageBase64: "abc",
      remainingMl: 750,
      adminNote: "Ground truth",
    }));
  });
});
