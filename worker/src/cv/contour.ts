import { cv, ensureCv } from "./index.js";
import type { PreprocessedImage } from "./preprocess.js";
import { getBottleGeometry, calibrateFillRatio, isSupportedBottle } from "./geometry.js";
import type { BottleGeometry } from "./geometry.js";
import { scoreContours } from "./scoring.js";
import type { ContourRect } from "./scoring.js";

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
      if (area < 100) continue;
      const rect = cv.boundingRect(c);
      contourRects.push({ origIdx: i, x: rect.x, y: rect.y, w: rect.width, h: rect.height, area });
    }

    const scored = scoreContours(contourRects, width, height);
    if (scored === null) {
      return {
        found: false,
        meniscusY: null,
        meniscusYRatio: null,
        bottleTopY: geometry.fillTopY * height,
        bottleBottomY: geometry.fillBottomY * height,
        edgeStrength: 0,
        contourCount: contours.size(),
        geometry,
        missReason: `heuristic_rejected(no_valid_contours)`,
      };
    }

    const bestIdx = contourRects[scored.idx].origIdx;
    const bestScore = scored.score;

    let bottleTopY: number;
    let bottleBottomY: number;
    let localBottleRect: { x: number; y: number; w: number; h: number };

    if (fallbackRegion) {
      bottleTopY = fallbackRegion.y;
      bottleBottomY = fallbackRegion.y + fallbackRegion.h;
      localBottleRect = fallbackRegion;
    } else if (bestIdx === -1 || bestScore < 0.3) {
      return {
        found: false,
        meniscusY: null,
        meniscusYRatio: null,
        bottleTopY: geometry.fillTopY * height,
        bottleBottomY: geometry.fillBottomY * height,
        edgeStrength: 0,
        contourCount: contours.size(),
        geometry,
        missReason: `heuristic_rejected(bestScore=${bestScore.toFixed(2)})`,
      };
    } else {
      const bottleContour = contours.get(bestIdx);
      const cr = cv.boundingRect(bottleContour);

      // Area sanity: reject if contour bounding box is >50% of frame (false large contour)
      const bottleArea = cr.width * cr.height;
      const frameArea = width * height;
      if (bottleArea / frameArea > 0.50) {
        return {
          found: false,
          meniscusY: null,
          meniscusYRatio: null,
          bottleTopY: geometry.fillTopY * height,
          bottleBottomY: geometry.fillBottomY * height,
          edgeStrength: 0,
          contourCount: contours.size(),
          geometry,
          missReason: `area_outlier(${(bottleArea / frameArea * 100).toFixed(0)}% frame)`,
        };
      }

      bottleTopY = cr.y;
      bottleBottomY = cr.y + cr.height;
      localBottleRect = { x: cr.x, y: cr.y, w: cr.width, h: cr.height };
    }

    // Find horizontal edges within the bottle body
    const roi = equalized.roi(new cv.Rect(localBottleRect.x, localBottleRect.y, localBottleRect.w, localBottleRect.h));
    const horizontalGradients = findHorizontalEdges(roi);
    roi.delete();

    if (horizontalGradients.length === 0) {
      return {
        found: false,
        meniscusY: null,
        meniscusYRatio: null,
        bottleTopY: localBottleRect.y,
        bottleBottomY: localBottleRect.y + localBottleRect.h,
        edgeStrength: 0,
        contourCount: contours.size(),
        geometry,
        missReason: `no_meniscus_edge(roi=${localBottleRect.w}x${localBottleRect.h})`,
      };
    }

    // Pick the best meniscus edge — prefer mid-bottle positions
    // The meniscus is most likely in the middle 60% of the bottle body
    // Score: edge strength * position bonus (edges near center are more likely meniscus)
    const midY = localBottleRect.h / 2;
    const best = horizontalGradients.reduce((a, b) => {
      const posBonusA = 1 - Math.abs(a.y - midY) / midY;
      const posBonusB = 1 - Math.abs(b.y - midY) / midY;
      return (a.strength * (0.3 + 0.7 * posBonusA)) > (b.strength * (0.3 + 0.7 * posBonusB)) ? a : b;
    });
    const meniscusY = localBottleRect.y + best.y;
    const rawRatio = (meniscusY - localBottleRect.y) / localBottleRect.h;
    const fillRatio = calibrateFillRatio(rawRatio, geometry);

    return {
      found: true,
      meniscusY,
      meniscusYRatio: fillRatio,
      bottleTopY: localBottleRect.y,
      bottleBottomY: localBottleRect.y + localBottleRect.h,
      edgeStrength: best.strength,
      contourCount: contours.size(),
      geometry,
    };
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
