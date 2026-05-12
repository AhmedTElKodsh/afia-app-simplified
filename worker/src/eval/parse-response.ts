import { z } from "zod";

const Schema = z.object({
  remainingMl: z.number(),
  consumedMl: z.number(),
  redLineYRatio: z.number(),
  confidence: z.number(),
});

const EvidenceSchema = z.object({
  readingPossible: z.boolean(),
  meniscusVisible: z.enum(["yes", "no", "uncertain"]),
  oilSurfaceYRatio: z.number(),
  nearestReferenceMl: z.number(),
  fillPercent: z.number(),
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
  const fillPercent = clamp(v.fillPercent, 0, 100);
  const remainingMl = Math.round(fillPercent * 15);
  return {
    readingPossible: v.readingPossible,
    meniscusVisible: v.meniscusVisible,
    oilSurfaceYRatio: clamp(v.oilSurfaceYRatio, 0, 1),
    nearestReferenceMl: Math.round(clamp(v.nearestReferenceMl, 0, 1500)),
    fillPercent,
    qualityFlags: v.qualityFlags,
    confidence: clamp(v.confidence, 0, 1),
    remainingMl,
    consumedMl: 1500 - remainingMl,
    redLineYRatio: clamp(v.oilSurfaceYRatio, 0, 1),
  };
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
