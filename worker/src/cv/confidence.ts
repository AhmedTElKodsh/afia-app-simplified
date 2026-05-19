import type { ContourResult } from "./contour.js";

export const CONFIDENCE_CONFIG = {
  // Edge clarity normalization threshold — higher = harder to reach high confidence
  edgeMax: 2000,
  // Noise penalty cap per 100 contours
  noisePenaltyCap: 0.25,
  // Extreme ratio penalty (ratio near 0 or 1)
  extremePenalty: 0.2,
  // Edge clarity thresholds for tier classification
  edgeHighThreshold: 0.7,
  edgeMediumThreshold: 0.3,
};

export interface ConfidenceResult {
  score: number;
  tier: "high" | "medium" | "low";
  reasons: string[];
}

/**
 * Pure edge-clarity confidence scoring with extreme-ratio penalty.
 * Extreme fill ratios (near 0 or 1) get a confidence penalty because
 * they're more likely to be Sobel picking bottle boundaries, not the meniscus.
 */
export function scoreConfidence(contour: ContourResult): ConfidenceResult {
  if (!contour.found) {
    return { score: 0, tier: "low", reasons: ["No contour found"] };
  }

  const reasons: string[] = [];

  // Edge clarity (0-1): how strong is the meniscus edge?
  const edgeClarity = Math.min(1, contour.edgeStrength / CONFIDENCE_CONFIG.edgeMax);

  // Penalty: high contour count suggests noise
  const noisePenalty = Math.min(1, contour.contourCount / 100) * CONFIDENCE_CONFIG.noisePenaltyCap;

  // Extreme-ratio penalty: ratios near 0 or 1 are suspicious
  // (likely bottle boundary, not meniscus)
  const ratio = contour.meniscusYRatio ?? 0.5;
  const extremePenalty = ratio < 0.05 ? CONFIDENCE_CONFIG.extremePenalty : ratio > 0.95 ? CONFIDENCE_CONFIG.extremePenalty : 0;
  if (extremePenalty > 0) reasons.push(`Extreme ratio (${(ratio * 100).toFixed(0)}%)`);

  let score = Math.max(0, Math.min(1, edgeClarity - noisePenalty - extremePenalty));

  let tier: "high" | "medium" | "low";
  if (score >= CONFIDENCE_CONFIG.edgeHighThreshold) {
    tier = "high";
  } else if (score >= CONFIDENCE_CONFIG.edgeMediumThreshold) {
    tier = "medium";
  } else {
    tier = "low";
  }

  if (noisePenalty > 0.05) reasons.push(`Noise penalty: ${contour.contourCount} contours`);
  if (edgeClarity < 0.5) reasons.push(`Low edge clarity: ${contour.edgeStrength.toFixed(0)}`);

  return { score, tier, reasons };
}
