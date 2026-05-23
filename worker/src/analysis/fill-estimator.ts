import { BOTTLE_1_5L, type BottleSize, type VisualEvidence } from "@afia/shared";
import { afia15lFillRatioFromMeniscus, yRatioWithinBottle } from "./afia-15l-calibration.js";

export type FillEstimateStatus = "measured" | "needs_review";

export interface FillEstimateInput {
  bottleSize: BottleSize;
  evidence: VisualEvidence;
}

export interface FillEstimate {
  status: FillEstimateStatus;
  remainingMl: number | null;
  consumedMl: number | null;
  redLineYRatio: number | null;
  fillPercent: number | null;
  confidence: number;
  warnings: string[];
  refusalReason: string | null;
  provenance: {
    bottleTopY: number | null;
    bottleBottomY: number | null;
    liquidLineY: number | null;
  };
}

export function estimateFillFromEvidence(input: FillEstimateInput): FillEstimate {
  const warnings = uniqueWarnings(input.evidence.qualityFlags);
  const review = (reason: string, extraWarnings: string[] = []): FillEstimate => ({
    status: "needs_review",
    remainingMl: null,
    consumedMl: null,
    redLineYRatio: null,
    fillPercent: null,
    confidence: input.evidence.evidenceConfidence,
    warnings: uniqueWarnings([...warnings, ...extraWarnings]),
    refusalReason: reason,
    provenance: { bottleTopY: null, bottleBottomY: null, liquidLineY: null },
  });

  if (input.bottleSize !== "1.5L" || input.evidence.bottleType === "afia_2_5l") {
    return review("unsupported_product", ["unsupported_product"]);
  }
  if (!input.evidence.bottleDetected || input.evidence.bottleType !== "afia_1_5l") {
    return review("unknown_product", ["unknown_product"]);
  }
  if (!input.evidence.topVisible || !input.evidence.bottomVisible) {
    return review("partial_bottle", ["partial_bottle"]);
  }
  if (!input.evidence.liquidBoundaryVisible) {
    return review("liquid_boundary_not_visible", ["low_confidence"]);
  }
  if (!input.evidence.bottleBox || !input.evidence.liquidLine) {
    return review("missing_geometry", ["low_confidence"]);
  }

  const bottleTopY = input.evidence.bottleBox.yMin;
  const bottleBottomY = input.evidence.bottleBox.yMax;
  const liquidLineY = median(input.evidence.liquidLine.points.map((point) => point.y));
  if (liquidLineY < bottleTopY || liquidLineY > bottleBottomY) {
    return review("liquid_line_outside_bottle", ["low_confidence"]);
  }

  const yRatioInBottle = yRatioWithinBottle(liquidLineY, bottleTopY, bottleBottomY);
  const fillFraction = afia15lFillRatioFromMeniscus(yRatioInBottle);
  const remainingMl = Math.round(fillFraction * BOTTLE_1_5L.capacityMl);
  const consumedMl = BOTTLE_1_5L.capacityMl - remainingMl;

  return {
    status: "measured",
    remainingMl,
    consumedMl,
    redLineYRatio: round4(liquidLineY / 1000),
    fillPercent: Math.round(fillFraction * 100),
    confidence: input.evidence.evidenceConfidence,
    warnings,
    refusalReason: null,
    provenance: { bottleTopY, bottleBottomY, liquidLineY },
  };
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

function uniqueWarnings(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
}

function round4(n: number) {
  return Math.round(n * 10000) / 10000;
}
