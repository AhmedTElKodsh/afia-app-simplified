export const CONTOUR_CONFIG = {
  // Min contour area (pixels) — smaller values capture more candidates
  minContourArea: 100,
  // Max bottle contour area as fraction of frame — reject > this ratio
  maxBottleAreaRatio: 0.45,
};

import { cv, ensureCv } from "./index.js";
import type { PreprocessedImage } from "./preprocess.js";
import { getBottleGeometry, calibrateFillRatio, isSupportedBottle } from "./geometry.js";
import type { BottleGeometry } from "./geometry.js";
import { scoreContours, scoreContoursTopN } from "./scoring.js";
import type { ContourRect } from "./scoring.js";

// Fusion config: set to true to enable multi-contour fusion
export const FUSION_CONFIG = {
  // Fusion disabled: testing showed it increased empty↔full confusion (6 vs 4 flips on 30 edge-case)
  // despite improving overall exact accuracy (20% vs 13.3%). Reverted to single best-contour.
  // See runs/heuristic-tuning/fusion-decision.md for detailed comparison.
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
      missReason,
    });

    const detectFromRect = (rect: { x: number; y: number; w: number; h: number }) => {
      const roi = equalized.roi(new cv.Rect(rect.x, rect.y, rect.w, rect.h));
      const horizontalGradients = findHorizontalEdges(roi);
      roi.delete();

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
          missReason: `no_meniscus_edge(roi=${rect.w}x${rect.h})`,
        };
      }

      const midY = rect.h / 2;
      const best = horizontalGradients.reduce((a, b) => {
        const posBonusA = 1 - Math.abs(a.y - midY) / midY;
        const posBonusB = 1 - Math.abs(b.y - midY) / midY;
        return (a.strength * (0.3 + 0.7 * posBonusA)) > (b.strength * (0.3 + 0.7 * posBonusB)) ? a : b;
      });
      const meniscusY = rect.y + best.y;
      const rawRatio = (meniscusY - rect.y) / rect.h;
      const fillRatio = calibrateFillRatio(rawRatio, geometry);

      return {
        found: true as const,
        meniscusY,
        meniscusYRatio: fillRatio,
        bottleTopY: rect.y,
        bottleBottomY: rect.y + rect.h,
        edgeStrength: best.strength,
        contourCount: contours.size(),
        geometry,
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

        const midY = cr.h / 2;
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
      const scored = scoreContours(contourRects, width, height);
      if (scored === null) {
        return fallbackResult("heuristic_rejected(no_valid_contours)");
      }
      return processSingle(scored);
    }
  } finally {
    contours.delete();
    hierarchy.delete();
  }
}

interface HorizontalEdge {
  y: number;
  strength: number;
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
        edges.push({ y, strength });
      }
    }

    return edges.sort((a, b) => b.strength - a.strength).slice(0, 5);
  } finally {
    gradY.delete();
    absGradY.delete();
    rowSums.delete();
  }
}
