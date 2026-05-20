import { beforeEach, describe, expect, it, vi } from "vitest";

const sampleRecord: {
  id: string;
  createdAt: string;
  bottleSize: "1.5L";
  imageUrl: string;
  remainingMl: number;
  consumedMl: number;
  redLineYRatio: number;
  confidence: number;
  warnings: string[];
  provider: "gemini";
  promptVersion: string;
  modelId: string;
  rawModelText: string;
  correctionStatus: "pending_review" | "approved" | "rejected" | "manual_corrected";
  adminFlag: "too_big" | "too_small" | "manual" | null;
  adminCorrectedMl: number | null;
  adminNote: string | null;
} = {
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
  saveUserCorrection: vi.fn(async () => ({
    ...sampleRecord,
    adminFlag: "manual",
    adminCorrectedMl: 715,
    adminNote: "User submitted correction: Slider adjustment",
  })),
}));

vi.mock("../src/storage/supabase.js", () => ({
  createAnalysisStorage: vi.fn(() => ({
    listAnalyses: mocks.listAnalyses,
    updateAnalysisCorrection: mocks.updateAnalysisCorrection,
    saveManualUpload: mocks.saveManualUpload,
    saveUserCorrection: mocks.saveUserCorrection,
  })),
}));

import app from "../src/index.js";

describe("admin routes", () => {
  beforeEach(() => {
    mocks.listAnalyses.mockClear();
    mocks.updateAnalysisCorrection.mockClear();
    mocks.saveManualUpload.mockClear();
    mocks.saveUserCorrection.mockClear();
  });

  it("requires the configured admin bearer token", async () => {
    const res = await app.request("/api/admin/analyses", {}, { ADMIN_TOKEN: "secret" });

    expect(res.status).toBe(401);
  });

  it("fails closed when the admin token is not configured", async () => {
    const res = await app.request("/api/admin/analyses");

    expect(res.status).toBe(401);
    await expect(res.json()).resolves.toEqual({ error: "Admin token is not configured" });
    expect(mocks.listAnalyses).not.toHaveBeenCalled();
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

  it("exports only trusted training labels by default", async () => {
    mocks.listAnalyses.mockResolvedValueOnce([
      {
        ...sampleRecord,
        id: "11111111-1111-4111-8111-111111111111",
        correctionStatus: "approved",
      },
      {
        ...sampleRecord,
        id: "22222222-2222-4222-8222-222222222222",
        correctionStatus: "manual_corrected",
        adminFlag: "too_small",
        adminCorrectedMl: 825,
      },
      {
        ...sampleRecord,
        id: "33333333-3333-4333-8333-333333333333",
        correctionStatus: "pending_review",
        adminCorrectedMl: 715,
      },
      {
        ...sampleRecord,
        id: "44444444-4444-4444-8444-444444444444",
        correctionStatus: "rejected",
      },
    ]);

    const res = await app.request(
      "/api/admin/dataset/export?limit=100",
      { headers: { authorization: "Bearer secret" } },
      { ADMIN_TOKEN: "secret" },
    );

    expect(res.status).toBe(200);
    const body = await res.json() as { trustedOnly: boolean; rows: Array<{ id: string; trustedLabel: boolean; labelSource: string; remainingMl: number }> };
    expect(body.trustedOnly).toBe(true);
    expect(body.rows).toHaveLength(2);
    expect(body.rows.map((row) => row.id)).toEqual([
      "11111111-1111-4111-8111-111111111111",
      "22222222-2222-4222-8222-222222222222",
    ]);
    expect(body.rows[0]).toMatchObject({ trustedLabel: true, labelSource: "model_prediction", remainingMl: 900 });
    expect(body.rows[1]).toMatchObject({ trustedLabel: true, labelSource: "admin_correction", remainingMl: 825 });
  });

  it("can include diagnostic-only records in the dataset export", async () => {
    mocks.listAnalyses.mockResolvedValueOnce([
      {
        ...sampleRecord,
        id: "33333333-3333-4333-8333-333333333333",
        correctionStatus: "pending_review",
        adminCorrectedMl: 715,
      },
    ]);

    const res = await app.request(
      "/api/admin/dataset/export?includeDiagnostics=true",
      { headers: { authorization: "Bearer secret" } },
      { ADMIN_TOKEN: "secret" },
    );

    expect(res.status).toBe(200);
    const body = await res.json() as { trustedOnly: boolean; rows: Array<{ id: string; trustedLabel: boolean; labelSource: string; remainingMl: number | null; excludeReason: string }> };
    expect(body.trustedOnly).toBe(false);
    expect(body.rows).toEqual([
      expect.objectContaining({
        id: "33333333-3333-4333-8333-333333333333",
        trustedLabel: false,
        labelSource: "diagnostic_only",
        remainingMl: null,
        excludeReason: "pending_review",
      }),
    ]);
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

  it("rejects admin corrections that do not match the 55 ml correction step", async () => {
    const res = await app.request(
      "/api/admin/analyses/0d44aecc-8344-44c8-8b7f-201216f7c9f9",
      {
        method: "PATCH",
        headers: { authorization: "Bearer secret", "content-type": "application/json" },
        body: JSON.stringify({
          correctionStatus: "manual_corrected",
          adminFlag: "too_big",
          adminCorrectedMl: 812,
          adminNote: "Adjusted",
        }),
      },
      { ADMIN_TOKEN: "secret" },
    );

    expect(res.status).toBe(400);
    expect(mocks.updateAnalysisCorrection).not.toHaveBeenCalled();
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

  it("saves user slider corrections for admin review", async () => {
    const res = await app.request(
      "/api/analyses/0d44aecc-8344-44c8-8b7f-201216f7c9f9/user-correction",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          correctedRemainingMl: 715,
          acceptedEstimate: false,
          note: "Slider adjustment",
        }),
      },
      {
        SUPABASE_URL: "https://example.supabase.co",
        SUPABASE_SERVICE_ROLE_KEY: "secret",
        GEMINI_API_KEY: "gemini",
        MODEL_ID: "gemini-test",
      },
    );

    expect(res.status).toBe(200);
    expect(mocks.saveUserCorrection).toHaveBeenCalledWith({
      id: "0d44aecc-8344-44c8-8b7f-201216f7c9f9",
      correctedRemainingMl: 715,
      acceptedEstimate: false,
      note: "Slider adjustment",
    });
  });

  it("rejects user corrections outside the correction scale", async () => {
    const res = await app.request(
      "/api/analyses/0d44aecc-8344-44c8-8b7f-201216f7c9f9/user-correction",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          correctedRemainingMl: 1500,
          acceptedEstimate: false,
          note: null,
        }),
      },
    );

    expect(res.status).toBe(400);
    expect(mocks.saveUserCorrection).not.toHaveBeenCalled();
  });
});
