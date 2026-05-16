import type { ContourResult } from "./contour.js";

export interface ConfidenceResult {
  score: number;
  tier: "high" | "medium" | "low";
  reasons: string[];
}

const EDGE_HIGH = 0.7;
const EDGE_MEDIUM = 0.3;
const EDGE_MAX = 2000;

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
  const edgeClarity = Math.min(1, contour.edgeStrength / EDGE_MAX);

  // Penalty: high contour count suggests noise
  const noisePenalty = Math.min(1, contour.contourCount / 100) * 0.15;

  // Extreme-ratio penalty: ratios near 0 or 1 are suspicious
  // (likely bottle boundary, not meniscus)
  const ratio = contour.meniscusYRatio ?? 0.5;
  const extremePenalty = ratio < 0.05 ? 0.2 : ratio > 0.95 ? 0.2 : 0;
  if (extremePenalty > 0) reasons.push(`Extreme ratio (${(ratio * 100).toFixed(0)}%)`);

  const score = Math.max(0, Math.min(1, edgeClarity - noisePenalty - extremePenalty));

  let tier: "high" | "medium" | "low";
  if (score >= EDGE_HIGH) {
    tier = "high";
  } else if (score >= EDGE_MEDIUM) {
    tier = "medium";
  } else {
    tier = "low";
  }

  if (noisePenalty > 0.05) reasons.push(`Noise penalty: ${contour.contourCount} contours`);
  if (edgeClarity < 0.5) reasons.push(`Low edge clarity: ${contour.edgeStrength.toFixed(0)}`);

  return { score, tier, reasons };
}
