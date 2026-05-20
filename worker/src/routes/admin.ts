import {
  AdminFlagSchema,
  type AnalysisRecord,
  BOTTLE_1_5L,
  CorrectionStatusSchema,
  DEFAULT_BOTTLE_SIZE,
  ML_PER_CUP_QUARTER,
  type AdminFlag,
  type BottleSize,
  type CorrectionStatus,
} from "@afia/shared";
import type { Context } from "hono";
import type { Env } from "../env.js";
import { createAnalysisStorage } from "../storage/supabase.js";

type AdminBindings = { Bindings: Env };

export async function listAnalysesRoute(c: Context<AdminBindings>) {
  const unauthorized = requireAdmin(c);
  if (unauthorized) return unauthorized;

  const limit = parseLimit(new URL(c.req.url).searchParams.get("limit"));
  const records = await createAnalysisStorage(c.env).listAnalyses({ limit });
  return c.json({ analyses: records });
}

export async function exportDatasetRoute(c: Context<AdminBindings>) {
  const unauthorized = requireAdmin(c);
  if (unauthorized) return unauthorized;

  const params = new URL(c.req.url).searchParams;
  const limit = parseLimit(params.get("limit"));
  const includeDiagnostics = params.get("includeDiagnostics") === "true";
  const records = await createAnalysisStorage(c.env).listAnalyses({ limit });
  const rows = records
    .map(toDatasetRow)
    .filter((row) => includeDiagnostics || row.trustedLabel);

  return c.json({
    datasetVersion: new Date().toISOString().slice(0, 10),
    trustedOnly: !includeDiagnostics,
    rows,
  });
}

export async function patchAnalysisRoute(c: Context<AdminBindings>) {
  const unauthorized = requireAdmin(c);
  if (unauthorized) return unauthorized;

  let body: AdminPatchBody;
  try {
    body = parseAdminPatch(await c.req.json().catch(() => null));
  } catch {
    return c.json({ error: "Invalid admin correction request" }, 400);
  }

  const record = await createAnalysisStorage(c.env).updateAnalysisCorrection(c.req.param("id"), body);
  return c.json({ analysis: record });
}

export async function manualUploadRoute(c: Context<AdminBindings>) {
  const unauthorized = requireAdmin(c);
  if (unauthorized) return unauthorized;

  let body: ManualUploadBody;
  try {
    body = parseManualUpload(await c.req.json().catch(() => null));
  } catch {
    return c.json({ error: "Invalid manual upload request" }, 400);
  }

  const record = await createAnalysisStorage(c.env).saveManualUpload({
    id: crypto.randomUUID(),
    ...body,
  });
  return c.json({ analysis: record }, 201);
}

type AdminPatchBody = {
  correctionStatus: CorrectionStatus;
  adminFlag: AdminFlag | null;
  adminCorrectedMl: number | null;
  adminNote: string | null;
};

type ManualUploadBody = {
  bottleSize: typeof DEFAULT_BOTTLE_SIZE;
  imageBase64: string;
  remainingMl: number;
  adminNote: string | null;
};

type DatasetCorrectionSource =
  | "model_prediction"
  | "user_submitted_correction"
  | "admin_correction"
  | "manual_ground_truth"
  | "diagnostic_only";

type DatasetExportRow = {
  id: string;
  imageUrl: string;
  bottleSize: BottleSize;
  trustedLabel: boolean;
  labelSource: DatasetCorrectionSource;
  correctionSource: DatasetCorrectionSource;
  remainingMl: number | null;
  consumedMl: number | null;
  redLineYRatio: number | null;
  originalRemainingMl: number;
  originalConsumedMl: number;
  originalRedLineYRatio: number;
  confidence: number;
  provider: string;
  promptVersion: string;
  modelId: string;
  correctionStatus: CorrectionStatus;
  qualityTags: string[];
  excludeReason: string | null;
  adminNote: string | null;
};

function requireAdmin(c: Context<AdminBindings>): Response | null {
  const adminToken = c.env?.ADMIN_TOKEN;
  if (!adminToken) return c.json({ error: "Admin token is not configured" }, 401);
  const expected = `Bearer ${adminToken}`;
  return c.req.header("authorization") === expected ? null : c.json({ error: "Unauthorized" }, 401);
}

function parseLimit(value: string | null): number {
  if (value === null) return 50;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 && parsed <= 200 ? parsed : 50;
}

function parseAdminPatch(value: unknown): AdminPatchBody {
  const record = objectValue(value);
  return {
    correctionStatus: CorrectionStatusSchema.parse(record.correctionStatus),
    adminFlag: nullable(record.adminFlag, (v) => AdminFlagSchema.parse(v)),
    adminCorrectedMl: nullable(record.adminCorrectedMl, correctionMlValue),
    adminNote: nullable(record.adminNote, stringValue),
  };
}

function parseManualUpload(value: unknown): ManualUploadBody {
  const record = objectValue(value);
  if (record.bottleSize !== DEFAULT_BOTTLE_SIZE) throw new Error("Unsupported bottle size");
  return {
    bottleSize: DEFAULT_BOTTLE_SIZE,
    imageBase64: nonEmptyString(record.imageBase64),
    remainingMl: boundedMlValue(record.remainingMl),
    adminNote: nullable(record.adminNote, stringValue),
  };
}

function objectValue(value: unknown): Record<string, unknown> {
  if (typeof value === "object" && value !== null && !Array.isArray(value)) return value as Record<string, unknown>;
  throw new Error("Expected object");
}

function stringValue(value: unknown): string {
  if (typeof value === "string") return value;
  throw new Error("Expected string");
}

function nonEmptyString(value: unknown): string {
  const text = stringValue(value);
  if (text.length > 0) return text;
  throw new Error("Expected non-empty string");
}

function integerAtLeastZero(value: unknown): number {
  if (typeof value === "number" && Number.isInteger(value) && value >= 0) return value;
  throw new Error("Expected integer at least zero");
}

function boundedMlValue(value: unknown): number {
  const n = integerAtLeastZero(value);
  if (n <= BOTTLE_1_5L.capacityMl) return n;
  throw new Error(`Expected integer between 0 and ${BOTTLE_1_5L.capacityMl}`);
}

function correctionMlValue(value: unknown): number {
  const n = integerAtLeastZero(value);
  const maxCorrectionMl = Math.floor(BOTTLE_1_5L.capacityMl / ML_PER_CUP_QUARTER) * ML_PER_CUP_QUARTER;
  if (n <= maxCorrectionMl && n % ML_PER_CUP_QUARTER === 0) return n;
  throw new Error(`Expected ${ML_PER_CUP_QUARTER} ml step between 0 and ${maxCorrectionMl}`);
}

function toDatasetRow(record: AnalysisRecord): DatasetExportRow {
  const hasUntrustedQuality = record.warnings.some((warning) => [
    "blur",
    "glare",
    "poor_lighting",
    "wrong_side",
    "partial_bottle",
    "poor_framing",
    "unknown_product",
    "unsupported_product",
    "uncertain_label",
  ].includes(warning));
  const excludeReason = datasetExcludeReason(record, hasUntrustedQuality);
  const labelMl = finalLabelMl(record);
  const trustedLabel = excludeReason === null && labelMl !== null;
  return {
    id: record.id,
    imageUrl: record.imageUrl,
    bottleSize: record.bottleSize,
    trustedLabel,
    labelSource: trustedLabel ? correctionSource(record) : "diagnostic_only",
    correctionSource: correctionSource(record),
    remainingMl: trustedLabel ? labelMl : null,
    consumedMl: trustedLabel ? BOTTLE_1_5L.capacityMl - labelMl : null,
    redLineYRatio: trustedLabel ? mlToYRatio(labelMl) : null,
    originalRemainingMl: record.remainingMl,
    originalConsumedMl: record.consumedMl,
    originalRedLineYRatio: record.redLineYRatio,
    confidence: record.confidence,
    provider: record.provider,
    promptVersion: record.promptVersion,
    modelId: record.modelId,
    correctionStatus: record.correctionStatus,
    qualityTags: record.warnings,
    excludeReason,
    adminNote: record.adminNote,
  };
}

function datasetExcludeReason(record: AnalysisRecord, hasUntrustedQuality: boolean): string | null {
  if (record.bottleSize !== DEFAULT_BOTTLE_SIZE) return "unsupported_product";
  if (record.correctionStatus === "rejected") return "rejected";
  if (hasUntrustedQuality) return "quality_tag";
  if (record.correctionStatus === "pending_review") return "pending_review";
  if (finalLabelMl(record) === null) return "missing_label";
  return null;
}

function finalLabelMl(record: AnalysisRecord): number | null {
  if (record.provider === "manual" && record.adminCorrectedMl !== null) return record.adminCorrectedMl;
  if (record.correctionStatus === "manual_corrected" && record.adminCorrectedMl !== null) return record.adminCorrectedMl;
  if (record.correctionStatus === "approved") return record.remainingMl;
  return null;
}

function correctionSource(record: AnalysisRecord): DatasetCorrectionSource {
  if (record.provider === "manual") return "manual_ground_truth";
  if (record.adminNote?.startsWith("User submitted correction")) return "user_submitted_correction";
  if (record.adminCorrectedMl !== null) return "admin_correction";
  if (record.correctionStatus === "approved") return "model_prediction";
  return "diagnostic_only";
}

function mlToYRatio(remainingMl: number): number {
  const fillFraction = remainingMl / BOTTLE_1_5L.capacityMl;
  return BOTTLE_1_5L.fillBottomY - fillFraction * (BOTTLE_1_5L.fillBottomY - BOTTLE_1_5L.fillTopY);
}

function nullable<T>(value: unknown, parse: (value: unknown) => T): T | null {
  if (value === null) return null;
  return parse(value);
}
