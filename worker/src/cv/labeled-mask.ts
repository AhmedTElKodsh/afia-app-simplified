import type { LiquidLineCandidate } from "./candidate-lines.js";
import type { ContourResult } from "./contour.js";
import { calibrateFillRatio, getBottleGeometry } from "./geometry.js";

export interface NormalizedBox {
  xMin: number;
  yMin: number;
  xMax: number;
  yMax: number;
}

export interface LabeledMaskEvidence {
  schemaVersion: "afia_labeled_mask_v1";
  labelSource: "human_keypoint" | "synthetic_mask" | "segmentation_model";
  bottleBox: NormalizedBox;
  liquidLineYRatioInBottle: number;
  confidence?: number;
}

export function contourFromLabeledMask(
  evidence: LabeledMaskEvidence,
  imageWidth: number,
  imageHeight: number,
  bottleSizeMl = 1500,
): ContourResult {
  const geometry = getBottleGeometry(bottleSizeMl);
  const rect = {
    x: Math.round(ratioCoord(evidence.bottleBox.xMin) * imageWidth),
    y: Math.round(ratioCoord(evidence.bottleBox.yMin) * imageHeight),
    w: Math.max(1, Math.round((ratioCoord(evidence.bottleBox.xMax) - ratioCoord(evidence.bottleBox.xMin)) * imageWidth)),
    h: Math.max(1, Math.round((ratioCoord(evidence.bottleBox.yMax) - ratioCoord(evidence.bottleBox.yMin)) * imageHeight)),
  };
  const yRatioInBottle = clamp(evidence.liquidLineYRatioInBottle, 0, 1);
  const meniscusY = rect.y + rect.h * yRatioInBottle;
  const fillRatio = calibrateFillRatio(yRatioInBottle, geometry);
  const edgeStrength = Math.round(1800 * clamp(evidence.confidence ?? 0.95, 0.1, 1));
  const candidate: LiquidLineCandidate = {
    id: "labeled-mask-line",
    y: round1(meniscusY),
    yRatioInBottle: round4(yRatioInBottle),
    score: round4(clamp(evidence.confidence ?? 0.95, 0, 1)),
    edgeStrength,
    horizontalCoverage: 0.9,
    source: "labeled_mask",
    angleDeg: 0,
    inlierCount: null,
    reason: `labeled_${evidence.labelSource}`,
  };

  return {
    found: true,
    meniscusY,
    meniscusYRatio: fillRatio,
    bottleTopY: rect.y,
    bottleBottomY: rect.y + rect.h,
    edgeStrength,
    contourCount: 1,
    geometry,
    lineCandidates: [candidate],
    bottleRect: rect,
    selectedLineSource: "labeled_mask",
    measurementState: "measured",
  };
}

function ratioCoord(value: number): number {
  return clamp(value > 1 ? value / 1000 : value, 0, 1);
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function round4(n: number): number {
  return Math.round(n * 10000) / 10000;
}
