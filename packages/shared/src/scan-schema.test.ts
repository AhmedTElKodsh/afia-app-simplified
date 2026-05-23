import { describe, expect, it } from "vitest";
import {
  AnalysisRecordSchema,
  AnalysisRequestSchema,
  AnalysisResultSchema,
  AdminFlagSchema,
  BottleSizeSchema,
  CorrectionStatusSchema,
  DEFAULT_BOTTLE_SIZE,
  VisualEvidenceSchema,
  SupabaseAnalysisRecordSchema,
  toSupabaseAnalysisRecord,
  PROVIDERS,
  ProviderSchema,
  ProductIdentitySchema,
  ScanWarningSchema,
  UserCorrectionRequestSchema,
  isSupportedAnalysisSize,
  getBottleSpec,
} from "./index";

describe("bottle constants", () => {
  it("models 1.5L as the default supported analysis size and 2.5L as pending", () => {
    expect(DEFAULT_BOTTLE_SIZE).toBe("1.5L");
    expect(isSupportedAnalysisSize("1.5L")).toBe(true);
    expect(isSupportedAnalysisSize("2.5L")).toBe(false);

    expect(getBottleSpec("1.5L")).toMatchObject({
      size: "1.5L",
      capacityMl: 1500,
      supportedForAnalysis: true,
      mlStep: 55,
    });
    expect(getBottleSpec("2.5L")).toMatchObject({
      size: "2.5L",
      capacityMl: 2500,
      supportedForAnalysis: false,
    });
  });

  it("validates product identity from scan links", () => {
    expect(BottleSizeSchema.parse("1.5L")).toBe("1.5L");
    expect(() => BottleSizeSchema.parse("bad")).toThrow();

    expect(ProductIdentitySchema.parse({ bottleSize: "1.5L" })).toEqual({ bottleSize: "1.5L" });
  });
});

describe("scan analysis schemas", () => {
  it("validates analysis requests and result contracts", () => {
    expect(AnalysisRequestSchema.parse({
      bottleSize: "1.5L",
      imageBase64: "data:image/jpeg;base64,abc",
    })).toMatchObject({ bottleSize: "1.5L" });

    expect(AnalysisResultSchema.parse({
      remainingMl: 880,
      consumedMl: 620,
      redLineYRatio: 0.42,
      confidence: 0.8,
      warnings: ["mild_glare"],
      provider: "gemini",
      rawMetadata: {
        promptVersion: "v1",
        modelId: "gemini-2.5-flash",
      },
    })).toMatchObject({
      consumedMl: 620,
      provider: "gemini",
    });

    expect(AnalysisResultSchema.parse({
      remainingMl: 500,
      consumedMl: 1000,
      redLineYRatio: 0.3,
      confidence: 0.9,
      warnings: [],
      provider: "cv",
      rawMetadata: {
        promptVersion: "v1",
        modelId: "opencv-v1",
      },
    })).toMatchObject({
      provider: "cv",
    });

    expect(AnalysisResultSchema.parse({
      remainingMl: 400,
      consumedMl: 1100,
      redLineYRatio: 0.25,
      confidence: 0.85,
      warnings: [],
      provider: "cv_llm",
      rawMetadata: {
        promptVersion: "v1",
        modelId: "opencv-llm-v1",
      },
    })).toMatchObject({
      provider: "cv_llm",
    });

    expect(AnalysisResultSchema.parse({
      remainingMl: 715,
      consumedMl: 785,
      redLineYRatio: 0.52,
      confidence: 0.76,
      warnings: ["low_confidence"],
      provider: "openrouter",
      rawMetadata: {
        promptVersion: "v1",
        modelId: "meta-llama/llama-3.2-11b-vision-instruct",
        fallbackReason: "gemini_failed",
      },
    })).toMatchObject({
      provider: "openrouter",
      rawMetadata: expect.objectContaining({ modelId: "meta-llama/llama-3.2-11b-vision-instruct" }),
    });
  });

  it("validates visual evidence with bounded bottle and liquid-line coordinates", () => {
    expect(VisualEvidenceSchema.parse({
      schemaVersion: "afia_visual_evidence_v1",
      bottleDetected: true,
      bottleType: "afia_1_5l",
      bottleTypeConfidence: 0.91,
      topVisible: true,
      bottomVisible: true,
      frontLabelVisible: true,
      liquidBoundaryVisible: true,
      bottleBox: { yMin: 100, xMin: 250, yMax: 900, xMax: 750 },
      liquidLine: {
        kind: "line",
        points: [{ x: 300, y: 500 }, { x: 700, y: 510 }],
      },
      qualityFlags: ["mild_glare"],
      evidenceConfidence: 0.82,
      refusalReason: null,
    })).toMatchObject({
      bottleType: "afia_1_5l",
      liquidLine: { points: expect.arrayContaining([expect.objectContaining({ y: 500 })]) },
    });

    expect(() => VisualEvidenceSchema.parse({
      schemaVersion: "afia_visual_evidence_v1",
      bottleDetected: true,
      bottleType: "afia_1_5l",
      bottleTypeConfidence: 1,
      topVisible: true,
      bottomVisible: true,
      frontLabelVisible: true,
      liquidBoundaryVisible: true,
      bottleBox: { yMin: 100, xMin: 250, yMax: 900, xMax: 750 },
      liquidLine: { kind: "line", points: [{ x: 300, y: 1200 }] },
      qualityFlags: [],
      evidenceConfidence: 0.82,
      refusalReason: null,
    })).toThrow(/liquidLine.points.0.y/);
  });

  it("defines provider, warning, and correction enums for Supabase records", () => {
    expect(PROVIDERS).toEqual(["gemini", "openrouter", "grok", "cv", "cv_llm", "manual"]);
    expect(ScanWarningSchema.parse("wrong_side")).toBe("wrong_side");
    expect(ScanWarningSchema.parse("poor_lighting")).toBe("poor_lighting");
    expect(ProviderSchema.parse("manual")).toBe("manual");
    expect(CorrectionStatusSchema.parse("manual_corrected")).toBe("manual_corrected");
    expect(AdminFlagSchema.parse("too_big")).toBe("too_big");
    expect(AdminFlagSchema.parse("too_small")).toBe("too_small");
    expect(() => ProviderSchema.parse("unknown")).toThrow();
  });

  it("validates user correction payloads on the shared 55 ml scale", () => {
    expect(UserCorrectionRequestSchema.parse({
      correctedRemainingMl: 715,
      acceptedEstimate: false,
      note: "slider adjustment",
    })).toMatchObject({
      correctedRemainingMl: 715,
      acceptedEstimate: false,
    });

    expect(() => UserCorrectionRequestSchema.parse({
      correctedRemainingMl: 1500,
      acceptedEstimate: false,
      note: null,
    })).toThrow(/55 ml step/);
  });

  it("validates product analysis records", () => {
    const record = AnalysisRecordSchema.parse({
      id: "0d44aecc-8344-44c8-8b7f-201216f7c9f9",
      createdAt: "2026-05-10T09:00:00.000Z",
      bottleSize: "1.5L",
      imageUrl: "https://example.com/image.jpg",
      remainingMl: 880,
      consumedMl: 620,
      redLineYRatio: 0.42,
      confidence: 0.8,
      warnings: ["mild_glare"],
      provider: "gemini",
      promptVersion: "v1",
      modelId: "gemini-2.5-flash",
      rawModelText: "{}",
      correctionStatus: "pending_review",
      adminFlag: null,
      adminCorrectedMl: null,
      adminNote: null,
    });

    expect(record.correctionStatus).toBe("pending_review");
  });

  it("validates and maps Supabase snake_case analysis records", () => {
    const record = SupabaseAnalysisRecordSchema.parse({
      id: "0d44aecc-8344-44c8-8b7f-201216f7c9f9",
      created_at: "2026-05-10T09:00:00.000Z",
      bottle_size: "1.5L",
      image_url: "https://example.com/image.jpg",
      remaining_ml: 880,
      consumed_ml: 620,
      red_line_y_ratio: 0.42,
      confidence: 0.8,
      warnings: ["mild_glare"],
      provider: "gemini",
      prompt_version: "v1",
      model_id: "gemini-2.5-flash",
      raw_model_text: "{}",
      correction_status: "manual_corrected",
      admin_flag: "too_big",
      admin_corrected_ml: 825,
      admin_note: "Adjusted by reviewer",
    });

    expect(record.admin_flag).toBe("too_big");
    expect(toSupabaseAnalysisRecord({
      id: record.id,
      createdAt: record.created_at,
      bottleSize: record.bottle_size,
      imageUrl: record.image_url,
      remainingMl: record.remaining_ml,
      consumedMl: record.consumed_ml,
      redLineYRatio: record.red_line_y_ratio,
      confidence: record.confidence,
      warnings: record.warnings,
      provider: record.provider,
      promptVersion: record.prompt_version,
      modelId: record.model_id,
      rawModelText: record.raw_model_text,
      correctionStatus: record.correction_status,
      adminFlag: record.admin_flag,
      adminCorrectedMl: record.admin_corrected_ml,
      adminNote: record.admin_note,
    })).toMatchObject({
      created_at: record.created_at,
      red_line_y_ratio: record.red_line_y_ratio,
      admin_flag: "too_big",
    });
  });
});
