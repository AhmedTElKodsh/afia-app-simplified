import { describe, expect, it } from "vitest";
import {
  AnalysisRecordSchema,
  AnalysisRequestSchema,
  AnalysisResultSchema,
  AdminFlagSchema,
  BottleSizeSchema,
  CorrectionStatusSchema,
  DEFAULT_BOTTLE_SIZE,
  SupabaseAnalysisRecordSchema,
  toSupabaseAnalysisRecord,
  PROVIDERS,
  ProductIdentitySchema,
  ScanWarningSchema,
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
  });

  it("defines provider, warning, and correction enums for Supabase records", () => {
    expect(PROVIDERS).toEqual(["gemini", "grok"]);
    expect(ScanWarningSchema.parse("wrong_side")).toBe("wrong_side");
    expect(CorrectionStatusSchema.parse("manual_corrected")).toBe("manual_corrected");
    expect(AdminFlagSchema.parse("too_big")).toBe("too_big");
    expect(AdminFlagSchema.parse("too_small")).toBe("too_small");
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
