import { SUPPORTED_BOTTLE_SIZES, type BottleSize } from "./bottle.js";

export const PROVIDERS = ["gemini", "grok", "cv", "cv_llm"] as const;
export const SCAN_WARNINGS = [
  "blur",
  "glare",
  "mild_glare",
  "wrong_side",
  "partial_bottle",
  "poor_framing",
  "unknown_product",
  "low_confidence",
] as const;
export const CORRECTION_STATUSES = ["pending_review", "approved", "rejected", "manual_corrected"] as const;
export const ADMIN_FLAGS = ["too_big", "too_small", "manual"] as const;

export type Provider = (typeof PROVIDERS)[number];
export type ScanWarning = (typeof SCAN_WARNINGS)[number] | string;
export type CorrectionStatus = (typeof CORRECTION_STATUSES)[number];
export type AdminFlag = (typeof ADMIN_FLAGS)[number];

export interface ProductIdentity {
  bottleSize: BottleSize;
}

export interface AnalysisRequest extends ProductIdentity {
  imageBase64: string;
}

export interface ProviderEvidence {
  readingPossible: boolean;
  meniscusVisible: "yes" | "no" | "uncertain";
  oilSurfaceYRatio: number;
  nearestReferenceMl: number;
  qualityFlags: string[];
  confidence: number;
}

export interface AnalysisResultContract {
  remainingMl: number;
  consumedMl: number;
  redLineYRatio: number;
  confidence: number;
  warnings: string[];
  provider: Provider;
  rawMetadata: {
    promptVersion: string;
    promptHash?: string;
    fewshotHash?: string;
    modelId: string;
    providerModelVersion?: string;
    fallbackReason?: string;
    rawModelText?: string;
  };
}

export interface AnalysisRecord {
  id: string;
  createdAt: string;
  bottleSize: BottleSize;
  imageUrl: string;
  remainingMl: number;
  consumedMl: number;
  redLineYRatio: number;
  confidence: number;
  warnings: string[];
  provider: Provider;
  promptVersion: string;
  modelId: string;
  rawModelText: string;
  correctionStatus: CorrectionStatus;
  adminFlag: AdminFlag | null;
  adminCorrectedMl: number | null;
  adminNote: string | null;
}

export interface SupabaseAnalysisRecord {
  id: string;
  created_at: string;
  bottle_size: BottleSize;
  image_url: string;
  remaining_ml: number;
  consumed_ml: number;
  red_line_y_ratio: number;
  confidence: number;
  warnings: string[];
  provider: Provider;
  prompt_version: string;
  model_id: string;
  raw_model_text: string;
  correction_status: CorrectionStatus;
  admin_flag: AdminFlag | null;
  admin_corrected_ml: number | null;
  admin_note: string | null;
}

interface Schema<T> {
  parse(value: unknown): T;
}

export const BottleSizeSchema = enumSchema(SUPPORTED_BOTTLE_SIZES, "bottleSize");
export const ProviderSchema = enumSchema(PROVIDERS, "provider");
export const ScanWarningSchema = enumSchema(SCAN_WARNINGS, "warning");
export const CorrectionStatusSchema = enumSchema(CORRECTION_STATUSES, "correctionStatus");
export const AdminFlagSchema = enumSchema(ADMIN_FLAGS, "adminFlag");

export const ProductIdentitySchema: Schema<ProductIdentity> = {
  parse(value) {
    const record = objectValue(value, "productIdentity");
    return { bottleSize: BottleSizeSchema.parse(record.bottleSize) };
  },
};

export const AnalysisRequestSchema: Schema<AnalysisRequest> = {
  parse(value) {
    const record = objectValue(value, "analysisRequest");
    return {
      bottleSize: BottleSizeSchema.parse(record.bottleSize),
      imageBase64: nonEmptyString(record.imageBase64, "imageBase64"),
    };
  },
};

export const ProviderEvidenceSchema: Schema<ProviderEvidence> = {
  parse(value) {
    const record = objectValue(value, "providerEvidence");
    return {
      readingPossible: booleanValue(record.readingPossible, "readingPossible"),
      meniscusVisible: enumValue(record.meniscusVisible, ["yes", "no", "uncertain"] as const, "meniscusVisible"),
      oilSurfaceYRatio: ratioValue(record.oilSurfaceYRatio, "oilSurfaceYRatio"),
      nearestReferenceMl: numberAtLeast(record.nearestReferenceMl, 0, "nearestReferenceMl"),
      qualityFlags: stringArray(record.qualityFlags, "qualityFlags"),
      confidence: ratioValue(record.confidence, "confidence"),
    };
  },
};

export const AnalysisResultSchema: Schema<AnalysisResultContract> = {
  parse(value) {
    const record = objectValue(value, "analysisResult");
    const rawMetadata = objectValue(record.rawMetadata, "rawMetadata");
    return {
      remainingMl: integerAtLeast(record.remainingMl, 0, "remainingMl"),
      consumedMl: integerAtLeast(record.consumedMl, 0, "consumedMl"),
      redLineYRatio: ratioValue(record.redLineYRatio, "redLineYRatio"),
      confidence: ratioValue(record.confidence, "confidence"),
      warnings: stringArray(record.warnings ?? [], "warnings"),
      provider: ProviderSchema.parse(record.provider),
      rawMetadata: {
        promptVersion: nonEmptyString(rawMetadata.promptVersion, "promptVersion"),
        promptHash: optionalString(rawMetadata.promptHash, "promptHash"),
        fewshotHash: optionalString(rawMetadata.fewshotHash, "fewshotHash"),
        modelId: nonEmptyString(rawMetadata.modelId, "modelId"),
        providerModelVersion: optionalString(rawMetadata.providerModelVersion, "providerModelVersion"),
        fallbackReason: optionalString(rawMetadata.fallbackReason, "fallbackReason"),
        rawModelText: optionalString(rawMetadata.rawModelText, "rawModelText"),
      },
    };
  },
};

export const AnalysisRecordSchema: Schema<AnalysisRecord> = {
  parse(value) {
    const record = objectValue(value, "analysisRecord");
    return {
      id: uuidValue(record.id, "id"),
      createdAt: dateTimeValue(record.createdAt, "createdAt"),
      bottleSize: BottleSizeSchema.parse(record.bottleSize),
      imageUrl: urlValue(record.imageUrl, "imageUrl"),
      remainingMl: integerAtLeast(record.remainingMl, 0, "remainingMl"),
      consumedMl: integerAtLeast(record.consumedMl, 0, "consumedMl"),
      redLineYRatio: ratioValue(record.redLineYRatio, "redLineYRatio"),
      confidence: ratioValue(record.confidence, "confidence"),
      warnings: stringArray(record.warnings ?? [], "warnings"),
      provider: ProviderSchema.parse(record.provider),
      promptVersion: nonEmptyString(record.promptVersion, "promptVersion"),
      modelId: nonEmptyString(record.modelId, "modelId"),
      rawModelText: stringValue(record.rawModelText, "rawModelText"),
      correctionStatus: CorrectionStatusSchema.parse(record.correctionStatus),
      adminFlag: nullable(record.adminFlag, (v) => AdminFlagSchema.parse(v), "adminFlag"),
      adminCorrectedMl: nullable(record.adminCorrectedMl, (v) => integerAtLeast(v, 0, "adminCorrectedMl"), "adminCorrectedMl"),
      adminNote: nullable(record.adminNote, (v) => stringValue(v, "adminNote"), "adminNote"),
    };
  },
};

export const SupabaseAnalysisRecordSchema: Schema<SupabaseAnalysisRecord> = {
  parse(value) {
    const record = objectValue(value, "supabaseAnalysisRecord");
    return {
      id: uuidValue(record.id, "id"),
      created_at: dateTimeValue(record.created_at, "created_at"),
      bottle_size: BottleSizeSchema.parse(record.bottle_size),
      image_url: urlValue(record.image_url, "image_url"),
      remaining_ml: integerAtLeast(record.remaining_ml, 0, "remaining_ml"),
      consumed_ml: integerAtLeast(record.consumed_ml, 0, "consumed_ml"),
      red_line_y_ratio: ratioValue(record.red_line_y_ratio, "red_line_y_ratio"),
      confidence: ratioValue(record.confidence, "confidence"),
      warnings: stringArray(record.warnings ?? [], "warnings"),
      provider: ProviderSchema.parse(record.provider),
      prompt_version: nonEmptyString(record.prompt_version, "prompt_version"),
      model_id: nonEmptyString(record.model_id, "model_id"),
      raw_model_text: stringValue(record.raw_model_text, "raw_model_text"),
      correction_status: CorrectionStatusSchema.parse(record.correction_status),
      admin_flag: nullable(record.admin_flag, (v) => AdminFlagSchema.parse(v), "admin_flag"),
      admin_corrected_ml: nullable(record.admin_corrected_ml, (v) => integerAtLeast(v, 0, "admin_corrected_ml"), "admin_corrected_ml"),
      admin_note: nullable(record.admin_note, (v) => stringValue(v, "admin_note"), "admin_note"),
    };
  },
};

export function toSupabaseAnalysisRecord(record: AnalysisRecord): SupabaseAnalysisRecord {
  return {
    id: record.id,
    created_at: record.createdAt,
    bottle_size: record.bottleSize,
    image_url: record.imageUrl,
    remaining_ml: record.remainingMl,
    consumed_ml: record.consumedMl,
    red_line_y_ratio: record.redLineYRatio,
    confidence: record.confidence,
    warnings: record.warnings,
    provider: record.provider,
    prompt_version: record.promptVersion,
    model_id: record.modelId,
    raw_model_text: record.rawModelText,
    correction_status: record.correctionStatus,
    admin_flag: record.adminFlag,
    admin_corrected_ml: record.adminCorrectedMl,
    admin_note: record.adminNote,
  };
}

function enumSchema<const T extends readonly string[]>(values: T, label: string): Schema<T[number]> {
  return { parse: (value) => enumValue(value, values, label) };
}

function enumValue<const T extends readonly string[]>(value: unknown, values: T, label: string): T[number] {
  if (typeof value === "string" && values.includes(value)) return value as T[number];
  throw new Error(`${label} must be one of ${values.join(", ")}`);
}

function objectValue(value: unknown, label: string): Record<string, unknown> {
  if (typeof value === "object" && value !== null && !Array.isArray(value)) return value as Record<string, unknown>;
  throw new Error(`${label} must be an object`);
}

function stringValue(value: unknown, label: string): string {
  if (typeof value === "string") return value;
  throw new Error(`${label} must be a string`);
}

function nonEmptyString(value: unknown, label: string): string {
  const text = stringValue(value, label);
  if (text.length > 0) return text;
  throw new Error(`${label} must not be empty`);
}

function optionalString(value: unknown, label: string): string | undefined {
  if (value === undefined) return undefined;
  return stringValue(value, label);
}

function booleanValue(value: unknown, label: string): boolean {
  if (typeof value === "boolean") return value;
  throw new Error(`${label} must be a boolean`);
}

function numberValue(value: unknown, label: string): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  throw new Error(`${label} must be a finite number`);
}

function numberInRange(value: unknown, min: number, max: number, label: string): number {
  const n = numberValue(value, label);
  if (n >= min && n <= max) return n;
  throw new Error(`${label} must be between ${min} and ${max}`);
}

function numberAtLeast(value: unknown, min: number, label: string): number {
  const n = numberValue(value, label);
  if (n >= min) return n;
  throw new Error(`${label} must be at least ${min}`);
}

function ratioValue(value: unknown, label: string): number {
  return numberInRange(value, 0, 1, label);
}

function integerAtLeast(value: unknown, min: number, label: string): number {
  const n = numberAtLeast(value, min, label);
  if (Number.isInteger(n)) return n;
  throw new Error(`${label} must be an integer`);
}

function stringArray(value: unknown, label: string): string[] {
  if (Array.isArray(value) && value.every((item) => typeof item === "string")) return value;
  throw new Error(`${label} must be an array of strings`);
}

function uuidValue(value: unknown, label: string): string {
  const text = stringValue(value, label);
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(text)) return text;
  throw new Error(`${label} must be a UUID`);
}

function dateTimeValue(value: unknown, label: string): string {
  const text = stringValue(value, label);
  if (!Number.isNaN(Date.parse(text))) return text;
  throw new Error(`${label} must be a date-time string`);
}

function urlValue(value: unknown, label: string): string {
  const text = stringValue(value, label);
  try {
    new URL(text);
    return text;
  } catch {
    throw new Error(`${label} must be a URL`);
  }
}

function nullable<T>(value: unknown, parse: (value: unknown) => T, label: string): T | null {
  if (value === null) return null;
  if (value === undefined) throw new Error(`${label} must be present`);
  return parse(value);
}
