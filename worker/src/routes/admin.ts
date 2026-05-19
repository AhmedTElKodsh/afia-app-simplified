import {
  AdminFlagSchema,
  CorrectionStatusSchema,
  DEFAULT_BOTTLE_SIZE,
  type AdminFlag,
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

function requireAdmin(c: Context<AdminBindings>): Response | null {
  if (!c.env.ADMIN_TOKEN) return null;
  const expected = `Bearer ${c.env.ADMIN_TOKEN}`;
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
    adminCorrectedMl: nullable(record.adminCorrectedMl, integerAtLeastZero),
    adminNote: nullable(record.adminNote, stringValue),
  };
}

function parseManualUpload(value: unknown): ManualUploadBody {
  const record = objectValue(value);
  if (record.bottleSize !== DEFAULT_BOTTLE_SIZE) throw new Error("Unsupported bottle size");
  return {
    bottleSize: DEFAULT_BOTTLE_SIZE,
    imageBase64: nonEmptyString(record.imageBase64),
    remainingMl: integerAtLeastZero(record.remainingMl),
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

function nullable<T>(value: unknown, parse: (value: unknown) => T): T | null {
  if (value === null) return null;
  return parse(value);
}
