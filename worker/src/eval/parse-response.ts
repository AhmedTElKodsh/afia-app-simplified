import { z } from "zod";

const Schema = z.object({
  remainingMl: z.number(),
  consumedMl: z.number(),
  redLineYRatio: z.number(),
  confidence: z.number(),
});

export function parseAnalysisResponse(raw: string) {
  let cleaned = raw.trim();
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/, "").replace(/```\s*$/, "");
  }
  let parsed: unknown;
  try { parsed = JSON.parse(cleaned); }
  catch (e) { throw new Error(`LLM response not JSON: ${(e as Error).message}`); }
  const v = Schema.parse(parsed);
  return {
    remainingMl: clamp(v.remainingMl, 0, 1500),
    consumedMl: clamp(v.consumedMl, 0, 1500),
    redLineYRatio: clamp(v.redLineYRatio, 0, 1),
    confidence: clamp(v.confidence, 0, 1),
  };
}

function clamp(n: number, lo: number, hi: number) { return Math.max(lo, Math.min(hi, n)); }
