import { BOTTLE_1_5L, VisualEvidenceSchema } from "@afia/shared";
import { z } from "zod";
import { estimateFillFromEvidence } from "../analysis/fill-estimator.js";

const Schema = z.object({
  remainingMl: z.number(),
  consumedMl: z.number(),
  redLineYRatio: z.number(),
  confidence: z.number(),
});

const EvidenceSchema = z.object({
  visualReasoning: z.string().optional(),
  readingPossible: z.boolean(),
  meniscusVisible: z.enum(["yes", "no", "uncertain"]),
  oilSurfaceYRatio: z.number(),
  nearestReferenceMl: z.number(),
  qualityFlags: z.array(z.string()),
  confidence: z.number(),
});

export function parseAnalysisResponse(raw: string) {
  const parsed = parseJson(raw);
  const v = Schema.parse(parsed);
  return {
    remainingMl: clamp(v.remainingMl, 0, 1500),
    consumedMl: clamp(v.consumedMl, 0, 1500),
    redLineYRatio: clamp(v.redLineYRatio, 0, 1),
    confidence: clamp(v.confidence, 0, 1),
  };
}

export function parseEvidenceResponse(raw: string) {
  const parsed = parseJson(raw);
  if (isVisualEvidence(parsed)) {
    const evidence = VisualEvidenceSchema.parse(parsed);
    const estimate = estimateFillFromEvidence({ bottleSize: "1.5L", evidence });
    if (estimate.status !== "measured" || estimate.remainingMl === null || estimate.consumedMl === null || estimate.redLineYRatio === null) {
      throw new Error(`LLM visual evidence requires review: ${estimate.refusalReason ?? "needs_review"}`);
    }

    return {
      schemaVersion: evidence.schemaVersion,
      status: estimate.status,
      readingPossible: true,
      meniscusVisible: "yes" as const,
      oilSurfaceYRatio: estimate.redLineYRatio,
      nearestReferenceMl: estimate.remainingMl,
      fillPercent: estimate.fillPercent ?? 0,
      qualityFlags: estimate.warnings,
      confidence: estimate.confidence,
      remainingMl: estimate.remainingMl,
      consumedMl: estimate.consumedMl,
      redLineYRatio: estimate.redLineYRatio,
      provenance: estimate.provenance,
    };
  }

  const v = EvidenceSchema.parse(parsed);
  const oilSurfaceYRatio = clamp(v.oilSurfaceYRatio, 0, 1);
  const normalizedFill = ratioFromOilSurface(oilSurfaceYRatio);
  const remainingMl = Math.round(BOTTLE_1_5L.capacityMl * normalizedFill);
  const fillPercent = Math.round(normalizedFill * 100);

  return {
    readingPossible: v.readingPossible,
    meniscusVisible: v.meniscusVisible,
    oilSurfaceYRatio,
    nearestReferenceMl: Math.round(clamp(v.nearestReferenceMl, 0, 1500)),
    fillPercent,
    qualityFlags: v.qualityFlags,
    confidence: clamp(v.confidence, 0, 1),
    remainingMl,
    consumedMl: BOTTLE_1_5L.capacityMl - remainingMl,
    redLineYRatio: oilSurfaceYRatio,
  };
}

function ratioFromOilSurface(oilSurfaceYRatio: number): number {
  const span = BOTTLE_1_5L.fillBottomY - BOTTLE_1_5L.fillTopY;
  if (span <= 0) return 0;
  return clamp((BOTTLE_1_5L.fillBottomY - oilSurfaceYRatio) / span, 0, 1);
}

function isVisualEvidence(value: unknown): boolean {
  return typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    (value as { schemaVersion?: unknown }).schemaVersion === "afia_visual_evidence_v1";
}

function parseJson(raw: string) {
  let cleaned = raw.trim();
  
  // Try to find a JSON code block first
  const codeBlockMatch = cleaned.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
  if (codeBlockMatch) {
    cleaned = codeBlockMatch[1];
  } else {
    // Fallback: find the first { and last }
    const firstBrace = cleaned.indexOf("{");
    const lastBrace = cleaned.lastIndexOf("}");
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      cleaned = cleaned.substring(firstBrace, lastBrace + 1);
    }
  }

  try { return JSON.parse(cleaned) as unknown; }
  catch (e) { throw new Error(`LLM response not JSON: ${(e as Error).message}\nRaw output starts with: ${raw.substring(0, 100)}`); }
}

function clamp(n: number, lo: number, hi: number) { return Math.max(lo, Math.min(hi, n)); }
