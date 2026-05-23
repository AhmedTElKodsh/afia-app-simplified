export const CONTOUR_CONFIG = {
  // Min contour area (pixels): smaller values capture more candidates.
  minContourArea: 100,
  // Max bottle contour area as fraction of frame: reject > this ratio.
  maxBottleAreaRatio: 0.45,
  // Reject tiny local patches before they can masquerade as bottle ROIs.
  minBottleRoiHeightPx: 60,
  minBottleRoiHeightRatio: 0.18,
};

import { cv, ensureCv } from "./index.js";
import type { PreprocessedImage } from "./preprocess.js";
import { getBottleGeometry, calibrateFillRatio, isSupportedBottle } from "./geometry.js";
import type { BottleGeometry } from "./geometry.js";
import { scoreContours, scoreContoursTopN } from "./scoring.js";
import type { ContourRect } from "./scoring.js";
import { fitRansacHorizontalEvidence, proposeLiquidLineCandidates, selectBestLiquidLineCandidate } from "./candidate-lines.js";
import type { LiquidLineCandidate } from "./candidate-lines.js";

// Fusion config: set to true to enable multi-contour fusion
export const FUSION_CONFIG = {
  // Fusion disabled: testing showed it increased empty/full confusion (6 vs 4 flips on 30 edge-case)
  // despite improving overall exact accuracy (20% vs 13.3%). Reverted to single best-contour.
  // See .kiro/specs/afia-project-reference/technical-reference.md for the summarized decision.
  enabled: false,
  topN: 3,
};

export interface ContourResult {
  found: boolean;
  meniscusY: number | null;
  meniscusYRatio: number | null;
  bottleTopY: number;
  bottleBottomY: number;
  edgeStrength: number;
  contourCount: number;
  geometry: BottleGeometry;
  lineCandidates?: LiquidLineCandidate[];
  bottleRect?: { x: number; y: number; w: number; h: number };
  selectedLineSource?: "candidate" | "fusion" | "labeled_mask";
  measurementState?: "measured" | "needs_review" | "failed";
  missReason?: string;
}

export async function detectMeniscus(preprocessed: PreprocessedImage, bottleSizeMl = 1500): Promise<ContourResult> {
  await ensureCv();

  const geometry = getBottleGeometry(bottleSizeMl);
  const { equalized, width, height } = preprocessed;
  const contours = new cv.MatVector();
  const hierarchy = new cv.Mat();

  try {
    // Primary: Canny edge detection
    const edges = new cv.Mat();
    cv.Canny(equalized, edges, 50, 150, 3, false);
    cv.findContours(edges, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);
    edges.delete();

    // Fallback: if no contours, try adaptive threshold on center 60% ROI
    // Skip contour scoring for fallback — use ROI as bottle bounding box directly
    let fallbackRegion: { x: number; y: number; w: number; h: number } | null = null;
    if (contours.size() === 0) {
      const roiX = Math.round(width * 0.2);
      const roiY = Math.round(height * 0.2);
      const roiW = Math.round(width * 0.6);
      const roiH = Math.round(height * 0.6);
      const roi = equalized.roi(new cv.Rect(roiX, roiY, roiW, roiH));

      const thresh = new cv.Mat();
      cv.adaptiveThreshold(roi, thresh, 255,
        cv.ADAPTIVE_THRESH_GAUSSIAN_C, cv.THRESH_BINARY_INV, 15, 3);

      const kernel = cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(5, 5));
      cv.morphologyEx(thresh, thresh, cv.MORPH_CLOSE, kernel);
      kernel.delete();

      const fallbackContours = new cv.MatVector();
      cv.findContours(thresh, fallbackContours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);

      if (fallbackContours.size() > 0) {
        fallbackRegion = { x: roiX, y: roiY, w: roiW, h: roiH };
        // Clone each contour to avoid use-after-free when fallbackContours is deleted
        for (let i = 0; i < fallbackContours.size(); i++) {
          const src = fallbackContours.get(i);
          const clone = new cv.Mat();
          src.copyTo(clone);
          contours.push_back(clone);
          clone.delete();
        }
      }

      roi.delete();
      thresh.delete();
      fallbackContours.delete();
    }

    if (contours.size() === 0) {
      return {
        found: false,
        meniscusY: null,
        meniscusYRatio: null,
        bottleTopY: geometry.fillTopY * height,
        bottleBottomY: geometry.fillBottomY * height,
        edgeStrength: 0,
        contourCount: 0,
        geometry,
        lineCandidates: [],
        measurementState: "failed",
        missReason: fallbackRegion ? "fallback_no_contours" : "canny_no_contours",
      };
    }

    // Score each contour for bottle-likeness using pure function (no OpenCV dep)
    const imageCenterX = width / 2;
    const imageCenterY = height / 2;
    const imageDiagonal = Math.sqrt(width * width + height * height);

    const contourRects: Array<{ origIdx: number; x: number; y: number; w: number; h: number; area: number }> = [];

    for (let i = 0; i < contours.size(); i++) {
      const c = contours.get(i);
      const area = cv.contourArea(c);
      if (area < CONTOUR_CONFIG.minContourArea) continue;
      const rect = cv.boundingRect(c);
      contourRects.push({ origIdx: i, x: rect.x, y: rect.y, w: rect.width, h: rect.height, area });
    }

    // --- Helper closures for contour scoring and meniscus detection ---
    const fallbackResult = (missReason: string) => ({
      found: false as const,
      meniscusY: null,
      meniscusYRatio: null,
      bottleTopY: geometry.fillTopY * height,
      bottleBottomY: geometry.fillBottomY * height,
      edgeStrength: 0,
      contourCount: contours.size(),
      geometry,
      lineCandidates: [],
      measurementState: "failed" as const,
      missReason,
    });

    const detectFromRect = (rect: { x: number; y: number; w: number; h: number }) => {
      const roiProblem = validateBottleRect(rect, width, height);
      if (roiProblem) {
        return {
          found: false as const,
          meniscusY: null,
          meniscusYRatio: null,
          bottleTopY: rect.y,
          bottleBottomY: rect.y + rect.h,
          edgeStrength: 0,
          contourCount: contours.size(),
          geometry,
          lineCandidates: [],
          bottleRect: rect,
          measurementState: "failed" as const,
          missReason: roiProblem,
        };
      }

      const roi = equalized.roi(new cv.Rect(rect.x, rect.y, rect.w, rect.h));
      const sobelEdges = findHorizontalEdges(roi);
      const houghEdges = findHoughHorizontalEdges(roi);
      roi.delete();
      const ransacEdge = fitRansacHorizontalEvidence([...sobelEdges, ...houghEdges]);
      const horizontalGradients = [
        ...(ransacEdge ? [ransacEdge] : []),
        ...houghEdges,
        ...sobelEdges,
      ];
      const lineCandidates = proposeLiquidLineCandidates({
        bottleRect: rect,
        edges: horizontalGradients,
        imageWidth: width,
        imageHeight: height,
      });

      if (horizontalGradients.length === 0) {
        return {
          found: false as const,
          meniscusY: null,
          meniscusYRatio: null,
          bottleTopY: rect.y,
          bottleBottomY: rect.y + rect.h,
          edgeStrength: 0,
          contourCount: contours.size(),
          geometry,
          lineCandidates,
          bottleRect: rect,
          measurementState: "failed" as const,
          missReason: `no_meniscus_edge(roi=${rect.w}x${rect.h})`,
        };
      }

      const bestCandidate = selectBestLiquidLineCandidate(lineCandidates);
      if (!bestCandidate) {
        return {
          found: false as const,
          meniscusY: null,
          meniscusYRatio: null,
          bottleTopY: rect.y,
          bottleBottomY: rect.y + rect.h,
          edgeStrength: horizontalGradients[0]?.strength ?? 0,
          contourCount: contours.size(),
          geometry,
          lineCandidates,
          bottleRect: rect,
          measurementState: "needs_review" as const,
          missReason: "no_valid_liquid_line_candidate",
        };
      }

      const meniscusY = bestCandidate.y;
      const rawRatio = (meniscusY - rect.y) / rect.h;
      const fillRatio = calibrateFillRatio(rawRatio, geometry);

      return {
        found: true as const,
        meniscusY,
        meniscusYRatio: fillRatio,
        bottleTopY: rect.y,
        bottleBottomY: rect.y + rect.h,
        edgeStrength: bestCandidate.edgeStrength,
        contourCount: contours.size(),
        geometry,
        lineCandidates,
        bottleRect: rect,
        selectedLineSource: "candidate" as const,
        measurementState: "measured" as const,
      };
    };

    const processSingle = (scored: { idx: number; score: number }) => {
      const bestIdx = contourRects[scored.idx].origIdx;

      if (fallbackRegion) {
        return detectFromRect(fallbackRegion);
      }
      if (bestIdx === -1) {
        return fallbackResult(`heuristic_rejected(score=${scored.score.toFixed(2)})`);
      }

      const bottleContour = contours.get(bestIdx);
      const cr = cv.boundingRect(bottleContour);

      const bottleArea = cr.width * cr.height;
      const frameArea = width * height;
      if (bottleArea / frameArea > CONTOUR_CONFIG.maxBottleAreaRatio) {
        return fallbackResult(`area_outlier(${(bottleArea / frameArea * 100).toFixed(0)}% frame)`);
      }

      return detectFromRect({ x: cr.x, y: cr.y, w: cr.width, h: cr.height });
    };

    const processScoredCandidates = (scored: Array<{ idx: number; score: number }>): ContourResult => {
      let firstFailure: ContourResult | null = null;
      for (const candidate of scored) {
        const result = processSingle(candidate);
        if (result.found || result.measurementState === "needs_review") return result;
        firstFailure ??= result;
        if (!result.missReason?.startsWith("bottle_roi_too_small") && !result.missReason?.startsWith("area_outlier")) {
          return result;
        }
      }

      const fallback = detectFromRect(centerBottleRegion(width, height));
      if (fallback.found || fallback.measurementState === "needs_review") return fallback;
      return firstFailure ?? fallback;
    };

    const processFusion = (
      scored: { all: Array<{ idx: number; score: number }>; best: { idx: number; score: number } | null },
    ) => {
      const topIdxs = scored.all.slice(0, FUSION_CONFIG.topN);
      const candidates: Array<{ meniscusY: number; edgeStrength: number; weight: number }> = [];
      let totalWeight = 0;
      let primaryRect: { x: number; y: number; w: number; h: number } | null = null;

      for (const sc of topIdxs) {
        const origIdx = contourRects[sc.idx].origIdx;
        if (origIdx < 0 || origIdx >= contours.size()) continue;

        const c = contours.get(origIdx);
        const cr = cv.boundingRect(c);

        if (cr.width * cr.height / (width * height) > CONTOUR_CONFIG.maxBottleAreaRatio) continue;

        if (primaryRect === null) {
          primaryRect = { x: cr.x, y: cr.y, w: cr.width, h: cr.height };
        }

        const roi = equalized.roi(new cv.Rect(cr.x, cr.y, cr.width, cr.height));
        const edges = findHorizontalEdges(roi);
        roi.delete();

        if (edges.length === 0) continue;

        const midY = cr.height / 2;
        const bestEdge = edges.reduce((a, b) => {
          const posBonusA = 1 - Math.abs(a.y - midY) / midY;
          const posBonusB = 1 - Math.abs(b.y - midY) / midY;
          return (a.strength * (0.3 + 0.7 * posBonusA)) > (b.strength * (0.3 + 0.7 * posBonusB)) ? a : b;
        });

        const weight = Math.max(0.01, sc.score);
        candidates.push({ meniscusY: cr.y + bestEdge.y, edgeStrength: bestEdge.strength, weight });
        totalWeight += weight;
      }

      if (candidates.length < 2 || primaryRect === null) {
        if (primaryRect !== null) return detectFromRect(primaryRect);
        return fallbackResult("fusion_insufficient_candidates");
      }

      const fusedMeniscusY = candidates.reduce((s, c) => s + c.meniscusY * c.weight, 0) / totalWeight;
      const fusedEdgeStrength = candidates.reduce((s, c) => s + c.edgeStrength * c.weight, 0) / totalWeight;

      const rawRatio = (fusedMeniscusY - primaryRect.y) / primaryRect.h;
      const fillRatio = calibrateFillRatio(rawRatio, geometry);

      return {
        found: true as const,
        meniscusY: Math.round(fusedMeniscusY),
        meniscusYRatio: fillRatio,
        bottleTopY: primaryRect.y,
        bottleBottomY: primaryRect.y + primaryRect.h,
        edgeStrength: Math.round(fusedEdgeStrength),
        contourCount: contours.size(),
        geometry,
        bottleRect: primaryRect,
        selectedLineSource: "fusion" as const,
        measurementState: "measured" as const,
        lineCandidates: candidates
          .sort((a, b) => b.weight - a.weight)
          .slice(0, FUSION_CONFIG.topN)
          .map((candidate, index) => ({
            id: `fusion-line-${index}`,
            y: Math.round(candidate.meniscusY),
            yRatioInBottle: primaryRect ? Math.max(0, Math.min(1, (candidate.meniscusY - primaryRect.y) / primaryRect.h)) : 0,
            score: Math.max(0, Math.min(1, candidate.weight)),
            edgeStrength: candidate.edgeStrength,
            horizontalCoverage: 1,
            source: "unknown" as const,
            angleDeg: null,
            inlierCount: null,
            reason: "fusion_candidate",
          })),
      };
    };

    // --- Multi-contour fusion: use top-N scored contours for robust meniscus estimation ---
    if (FUSION_CONFIG.enabled && contourRects.length >= 2) {
      const scored = scoreContoursTopN(contourRects, width, height, FUSION_CONFIG.topN);
      if (scored.best === null || scored.all.length < 2) {
        const singleScored = scoreContours(contourRects, width, height);
        if (singleScored === null) {
          return fallbackResult(scored.all.length === 0 ? "heuristic_rejected(no_valid_contours)" : `fusion_insufficient(${scored.all.length} scored)`);
        }
        return processSingle(singleScored);
      }
      return processFusion(scored);
    } else {
      const scored = scoreContoursTopN(contourRects, width, height, 8);
      if (scored.best === null || scored.all.length === 0) {
        return fallbackResult("heuristic_rejected(no_valid_contours)");
      }
      return processScoredCandidates(scored.all);
    }
  } finally {
    contours.delete();
    hierarchy.delete();
  }
}

function centerBottleRegion(width: number, height: number): { x: number; y: number; w: number; h: number } {
  return {
    x: Math.round(width * 0.24),
    y: Math.round(height * 0.04),
    w: Math.round(width * 0.52),
    h: Math.round(height * 0.9),
  };
}

interface HorizontalEdge {
  y: number;
  strength: number;
  source?: "sobel_row" | "hough_segment" | "ransac_cluster";
  xStart?: number;
  xEnd?: number;
  angleDeg?: number;
  inlierCount?: number;
}

function findHorizontalEdges(roi: any): HorizontalEdge[] {
  // Use OpenCV Sobel() for vectorized horizontal gradient detection
  // Then cv.reduce() for row-sum computation (instead of 2M JS iterations)
  const gradY = new cv.Mat();
  const absGradY = new cv.Mat();
  const rowSums = new cv.Mat();

  try {
    cv.Sobel(roi, gradY, cv.CV_64F, 0, 1, 3);
    cv.convertScaleAbs(gradY, absGradY);

    // Compute row sums in WASM — avoids O(n*m) JS pixel walk
    cv.reduce(absGradY, rowSums, 1, 0, cv.CV_32S);

    const rows = rowSums.rows;
    const edges: HorizontalEdge[] = [];

    for (let y = 0; y < rows; y++) {
      const strength = rowSums.intAt(y, 0);
      if (strength > 100) {
        edges.push({ y, strength, source: "sobel_row", ...findRowRun(absGradY, y, strength) });
      }
    }

    return selectSeparatedEdges(edges, Math.max(4, Math.round(rows * 0.035)), 12);
  } finally {
    gradY.delete();
    absGradY.delete();
    rowSums.delete();
  }
}

function findHoughHorizontalEdges(roi: any): HorizontalEdge[] {
  const canny = new cv.Mat();
  const lines = new cv.Mat();

  try {
    cv.Canny(roi, canny, 50, 150, 3, false);
    const minLineLength = Math.max(12, Math.round(roi.cols * 0.22));
    const maxLineGap = Math.max(4, Math.round(roi.cols * 0.04));
    const threshold = Math.max(10, Math.round(roi.cols * 0.08));
    cv.HoughLinesP(canny, lines, 1, Math.PI / 180, threshold, minLineLength, maxLineGap);

    const out: HorizontalEdge[] = [];
    const data = lines.data32S;
    for (let i = 0; i < data.length; i += 4) {
      const x1 = data[i];
      const y1 = data[i + 1];
      const x2 = data[i + 2];
      const y2 = data[i + 3];
      const dx = x2 - x1;
      const dy = y2 - y1;
      const length = Math.sqrt(dx * dx + dy * dy);
      const angleDeg = Math.atan2(dy, dx) * 180 / Math.PI;
      const horizontalAngle = Math.abs(normalizeHorizontalAngle(angleDeg));
      if (length < minLineLength || horizontalAngle > 10) continue;
      out.push({
        y: (y1 + y2) / 2,
        strength: Math.round(length * 50 + (10 - horizontalAngle) * 25),
        source: "hough_segment",
        xStart: Math.min(x1, x2),
        xEnd: Math.max(x1, x2),
        angleDeg: round1(horizontalAngle),
        inlierCount: 1,
      });
    }

    return selectSeparatedEdges(out, Math.max(4, Math.round(roi.rows * 0.035)), 8);
  } finally {
    canny.delete();
    lines.delete();
  }
}

function selectSeparatedEdges(edges: HorizontalEdge[], minSeparationPx: number, limit: number): HorizontalEdge[] {
  const selected: HorizontalEdge[] = [];
  for (const edge of edges.sort((a, b) => b.strength - a.strength)) {
    if (selected.some((item) => Math.abs(item.y - edge.y) < minSeparationPx)) continue;
    selected.push(edge);
    if (selected.length >= limit) break;
  }
  return selected;
}

function normalizeHorizontalAngle(angleDeg: number): number {
  let angle = angleDeg;
  while (angle <= -90) angle += 180;
  while (angle > 90) angle -= 180;
  return angle;
}

function validateBottleRect(rect: { w: number; h: number }, imageWidth: number, imageHeight: number): string | null {
  const minHeight = Math.max(CONTOUR_CONFIG.minBottleRoiHeightPx, imageHeight * CONTOUR_CONFIG.minBottleRoiHeightRatio);
  if (rect.h < minHeight) {
    return `bottle_roi_too_small(h=${rect.h},min=${Math.round(minHeight)})`;
  }

  if (rect.w <= 0 || rect.h <= 0 || imageWidth <= 0 || imageHeight <= 0) {
    return "bottle_roi_invalid_geometry";
  }

  return null;
}

function findRowRun(absGradY: any, y: number, strength: number): Pick<HorizontalEdge, "xStart" | "xEnd"> {
  const width = absGradY.cols;
  const threshold = Math.max(8, Math.round((strength / Math.max(1, width)) * 1.25));
  let xStart: number | undefined;
  let xEnd: number | undefined;

  for (let x = 0; x < width; x++) {
    if (absGradY.ucharAt(y, x) >= threshold) {
      xStart ??= x;
      xEnd = x;
    }
  }

  return xStart === undefined || xEnd === undefined ? {} : { xStart, xEnd };
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
