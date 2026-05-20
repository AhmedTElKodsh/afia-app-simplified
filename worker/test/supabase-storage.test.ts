import { describe, expect, it, vi } from "vitest";
import { createAnalysisStorage, createSupabaseAnalysisRecord } from "../src/storage/supabase.js";

describe("Supabase analysis storage", () => {
  it("requires Supabase credentials before creating storage", () => {
    expect(() => createAnalysisStorage({ MODEL_ID: "gemini-test", GEMINI_API_KEY: "gemini" })).toThrow(/SUPABASE_URL/);
  });

  it("uploads capture images and inserts snake_case analysis rows", async () => {
    const upload = vi.fn(async () => ({ data: { path: "analyses/test.jpg" }, error: null }));
    const getPublicUrl = vi.fn(() => ({ data: { publicUrl: "https://example.supabase.co/storage/test.jpg" } }));
    const insert = vi.fn(() => ({
      select: vi.fn(() => ({
        single: vi.fn(async () => ({
          data: {
            id: "0d44aecc-8344-44c8-8b7f-201216f7c9f9",
            created_at: "2026-05-10T09:00:00.000Z",
            bottle_size: "1.5L",
            image_url: "https://example.supabase.co/storage/test.jpg",
            remaining_ml: 900,
            consumed_ml: 600,
            red_line_y_ratio: 0.42,
            confidence: 0.8,
            warnings: ["mild_glare"],
            provider: "gemini",
            prompt_version: "v1",
            model_id: "gemini-test",
            raw_model_text: "{}",
            correction_status: "pending_review",
            admin_flag: null,
            admin_corrected_ml: null,
            admin_note: null,
          },
          error: null,
        })),
      })),
    }));
    const client = {
      storage: { from: vi.fn(() => ({ upload, getPublicUrl })) },
      from: vi.fn(() => ({ insert })),
    };

    const storage = createAnalysisStorage(
      {
        SUPABASE_URL: "https://example.supabase.co",
        SUPABASE_SERVICE_ROLE_KEY: "secret",
        SUPABASE_STORAGE_BUCKET: "analysis-images",
        GEMINI_API_KEY: "gemini",
        MODEL_ID: "gemini-test",
      },
      () => client as never,
    );

    const record = await storage.saveAnalysis({
      id: "0d44aecc-8344-44c8-8b7f-201216f7c9f9",
      bottleSize: "1.5L",
      imageBase64: "data:image/jpeg;base64,ZmFrZQ==",
      result: {
        remainingMl: 900,
        consumedMl: 600,
        redLineYRatio: 0.42,
        confidence: 0.8,
        warnings: ["mild_glare"],
        provider: "gemini",
        rawMetadata: {
          promptVersion: "v1",
          modelId: "gemini-test",
          rawModelText: "{}",
        },
      },
    });

    expect(client.storage.from).toHaveBeenCalledWith("analysis-images");
    expect(upload).toHaveBeenCalledWith(
      "analyses/0d44aecc-8344-44c8-8b7f-201216f7c9f9.jpg",
      expect.any(Uint8Array),
      expect.objectContaining({ contentType: "image/jpeg", upsert: false }),
    );
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({
      id: "0d44aecc-8344-44c8-8b7f-201216f7c9f9",
      bottle_size: "1.5L",
      image_url: "https://example.supabase.co/storage/test.jpg",
      red_line_y_ratio: 0.42,
      correction_status: "pending_review",
    }));
    expect(record.correctionStatus).toBe("pending_review");
  });

  it("builds Supabase insert records from product analysis contracts", () => {
    expect(createSupabaseAnalysisRecord({
      id: "0d44aecc-8344-44c8-8b7f-201216f7c9f9",
      createdAt: "2026-05-10T09:00:00.000Z",
      bottleSize: "1.5L",
      imageUrl: "https://example.com/image.jpg",
      result: {
        remainingMl: 900,
        consumedMl: 600,
        redLineYRatio: 0.42,
        confidence: 0.8,
        warnings: [],
        provider: "gemini",
        rawMetadata: { promptVersion: "v1", modelId: "gemini-test", rawModelText: "{}" },
      },
    })).toMatchObject({
      created_at: "2026-05-10T09:00:00.000Z",
      bottle_size: "1.5L",
      raw_model_text: "{}",
      admin_flag: null,
    });
  });

  it("updates user slider corrections as pending admin review", async () => {
    const update = vi.fn(() => ({
      eq: vi.fn(() => ({
        select: vi.fn(() => ({
          single: vi.fn(async () => ({
            data: {
              id: "0d44aecc-8344-44c8-8b7f-201216f7c9f9",
              created_at: "2026-05-10T09:00:00.000Z",
              bottle_size: "1.5L",
              image_url: "https://example.supabase.co/storage/test.jpg",
              remaining_ml: 900,
              consumed_ml: 600,
              red_line_y_ratio: 0.42,
              confidence: 0.8,
              warnings: [],
              provider: "gemini",
              prompt_version: "v1",
              model_id: "gemini-test",
              raw_model_text: "{}",
              correction_status: "pending_review",
              admin_flag: "manual",
              admin_corrected_ml: 715,
              admin_note: "User submitted correction: Slider adjustment",
            },
            error: null,
          })),
        })),
      })),
    }));
    const client = {
      storage: { from: vi.fn() },
      from: vi.fn(() => ({ update })),
    };
    const storage = createAnalysisStorage(
      {
        SUPABASE_URL: "https://example.supabase.co",
        SUPABASE_SERVICE_ROLE_KEY: "secret",
        SUPABASE_STORAGE_BUCKET: "analysis-images",
        GEMINI_API_KEY: "gemini",
        MODEL_ID: "gemini-test",
      },
      () => client as never,
    );

    const record = await storage.saveUserCorrection({
      id: "0d44aecc-8344-44c8-8b7f-201216f7c9f9",
      correctedRemainingMl: 715,
      acceptedEstimate: false,
      note: "Slider adjustment",
    });

    expect(update).toHaveBeenCalledWith({
      correction_status: "pending_review",
      admin_flag: "manual",
      admin_corrected_ml: 715,
      admin_note: "User submitted correction: Slider adjustment",
    });
    expect(record.adminCorrectedMl).toBe(715);
  });
});
