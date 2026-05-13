import { BOTTLE_1_5L } from "@afia/shared";
import { z } from "zod";

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

function parseJson(raw: string) {
  let cleaned = raw.trim();
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/, "").replace(/```\s*$/, "");
  }
  try { return JSON.parse(cleaned) as unknown; }
  catch (e) { throw new Error(`LLM response not JSON: ${(e as Error).message}`); }
}

function clamp(n: number, lo: number, hi: number) { return Math.max(lo, Math.min(hi, n)); }
