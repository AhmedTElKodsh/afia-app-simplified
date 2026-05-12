import { createClient } from "@supabase/supabase-js";
import {
  AnalysisRecordSchema,
  type AnalysisRecord,
  type AnalysisResultContract,
  type AdminFlag,
  type BottleSize,
  type CorrectionStatus,
  type SupabaseAnalysisRecord,
  SupabaseAnalysisRecordSchema,
  toSupabaseAnalysisRecord,
} from "@afia/shared";
import type { Env } from "../env.js";

const DEFAULT_BUCKET = "analysis-images";
const ANALYSES_TABLE = "analyses";

type SupabaseClientFactory = typeof createClient;

interface SaveAnalysisInput {
  id: string;
  bottleSize: BottleSize;
  imageBase64: string;
  result: AnalysisResultContract;
}

interface CreateRecordInput {
  id: string;
  createdAt: string;
  bottleSize: BottleSize;
  imageUrl: string;
  result: AnalysisResultContract;
}

interface ListAnalysesInput {
  limit: number;
}

interface UpdateCorrectionInput {
  correctionStatus: CorrectionStatus;
  adminFlag: AdminFlag | null;
  adminCorrectedMl: number | null;
  adminNote: string | null;
}

interface ManualUploadInput {
  id: string;
  bottleSize: BottleSize;
  imageBase64: string;
  remainingMl: number;
  adminNote: string | null;
}

export function createAnalysisStorage(env: Env, clientFactory: SupabaseClientFactory = createClient) {
  const url = required(env.SUPABASE_URL, "SUPABASE_URL");
  const serviceRoleKey = required(env.SUPABASE_SERVICE_ROLE_KEY, "SUPABASE_SERVICE_ROLE_KEY");
  const bucket = env.SUPABASE_STORAGE_BUCKET ?? DEFAULT_BUCKET;
  const client = clientFactory(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  return {
    async listAnalyses(input: ListAnalysesInput): Promise<AnalysisRecord[]> {
      const { data, error } = await client
        .from(ANALYSES_TABLE)
        .select("*")
        .order("created_at", { ascending: false })
        .limit(input.limit);
      if (error) throw new Error(`Supabase analysis list failed: ${error.message}`);

      return (data ?? []).map((record) => fromSupabaseAnalysisRecord(SupabaseAnalysisRecordSchema.parse(record)));
    },

    async updateAnalysisCorrection(id: string, input: UpdateCorrectionInput): Promise<AnalysisRecord> {
      const { data, error } = await client
        .from(ANALYSES_TABLE)
        .update({
          correction_status: input.correctionStatus,
          admin_flag: input.adminFlag,
          admin_corrected_ml: input.adminCorrectedMl,
          admin_note: input.adminNote,
        })
        .eq("id", id)
        .select()
        .single();
      if (error) throw new Error(`Supabase analysis correction update failed: ${error.message}`);

      return fromSupabaseAnalysisRecord(SupabaseAnalysisRecordSchema.parse(data));
    },

    async saveAnalysis(input: SaveAnalysisInput): Promise<AnalysisRecord> {
      const image = decodeImage(input.imageBase64);
      const extension = extensionForMimeType(image.mimeType);
      const path = `analyses/${input.id}.${extension}`;
      const storage = client.storage.from(bucket);
      const uploadResult = await storage.upload(path, image.bytes, {
        contentType: image.mimeType,
        cacheControl: "3600",
        upsert: false,
      });
      if (uploadResult.error) throw new Error(`Supabase image upload failed: ${uploadResult.error.message}`);

      const publicUrl = storage.getPublicUrl(uploadResult.data.path).data.publicUrl;
      const insertRecord = createSupabaseAnalysisRecord({
        id: input.id,
        createdAt: new Date().toISOString(),
        bottleSize: input.bottleSize,
        imageUrl: publicUrl,
        result: input.result,
      });

      const { data, error } = await client
        .from(ANALYSES_TABLE)
        .insert(insertRecord)
        .select()
        .single();
      if (error) throw new Error(`Supabase analysis insert failed: ${error.message}`);

      return fromSupabaseAnalysisRecord(SupabaseAnalysisRecordSchema.parse(data));
    },

    async saveManualUpload(input: ManualUploadInput): Promise<AnalysisRecord> {
      const image = decodeImage(input.imageBase64);
      const extension = extensionForMimeType(image.mimeType);
      const path = `manual/${input.id}.${extension}`;
      const storage = client.storage.from(bucket);
      const uploadResult = await storage.upload(path, image.bytes, {
        contentType: image.mimeType,
        cacheControl: "3600",
        upsert: false,
      });
      if (uploadResult.error) throw new Error(`Supabase manual image upload failed: ${uploadResult.error.message}`);

      const publicUrl = storage.getPublicUrl(uploadResult.data.path).data.publicUrl;
      const insertRecord = toSupabaseAnalysisRecord(AnalysisRecordSchema.parse({
        id: input.id,
        createdAt: new Date().toISOString(),
        bottleSize: input.bottleSize,
        imageUrl: publicUrl,
        remainingMl: input.remainingMl,
        consumedMl: Math.max(0, 1500 - input.remainingMl),
        redLineYRatio: 0,
        confidence: 1,
        warnings: [],
        provider: "gemini",
        promptVersion: "manual",
        modelId: "manual-upload",
        rawModelText: JSON.stringify({ source: "manual_upload", remainingMl: input.remainingMl }),
        correctionStatus: "manual_corrected",
        adminFlag: "manual",
        adminCorrectedMl: input.remainingMl,
        adminNote: input.adminNote,
      }));

      const { data, error } = await client
        .from(ANALYSES_TABLE)
        .insert(insertRecord)
        .select()
        .single();
      if (error) throw new Error(`Supabase manual analysis insert failed: ${error.message}`);

      return fromSupabaseAnalysisRecord(SupabaseAnalysisRecordSchema.parse(data));
    },
  };
}

export function createSupabaseAnalysisRecord(input: CreateRecordInput): SupabaseAnalysisRecord {
  return toSupabaseAnalysisRecord(AnalysisRecordSchema.parse({
    id: input.id,
    createdAt: input.createdAt,
    bottleSize: input.bottleSize,
    imageUrl: input.imageUrl,
    remainingMl: input.result.remainingMl,
    consumedMl: input.result.consumedMl,
    redLineYRatio: input.result.redLineYRatio,
    confidence: input.result.confidence,
    warnings: input.result.warnings,
    provider: input.result.provider,
    promptVersion: input.result.rawMetadata.promptVersion,
    modelId: input.result.rawMetadata.modelId,
    rawModelText: input.result.rawMetadata.rawModelText ?? "",
    correctionStatus: "pending_review",
    adminFlag: null,
    adminCorrectedMl: null,
    adminNote: null,
  }));
}

function fromSupabaseAnalysisRecord(record: SupabaseAnalysisRecord): AnalysisRecord {
  return AnalysisRecordSchema.parse({
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
  });
}

function required(value: string | undefined, name: string): string {
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function decodeImage(value: string): { bytes: Uint8Array; mimeType: string } {
  const match = /^data:([^;]+);base64,(.+)$/.exec(value);
  const mimeType = match?.[1] ?? "image/jpeg";
  const base64 = match?.[2] ?? value;
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return { bytes, mimeType };
}

function extensionForMimeType(mimeType: string): string {
  if (mimeType === "image/png") return "png";
  if (mimeType === "image/webp") return "webp";
  return "jpg";
}
