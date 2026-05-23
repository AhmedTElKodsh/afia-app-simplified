export const CONTOUR_SCORING_CONFIG = {
  aspectWeight: 0.38,
  centerWeight: 0.24,
  sizeWeight: 0.26,
  edgeClearanceWeight: 0.12,
  minScoreThreshold: 0.25,
};

export interface ContourRect {
  origIdx: number; x: number; y: number; w: number; h: number; area: number;
}

export interface ScoredContour {
  idx: number; score: number;
}

/**
 * Pure contour scoring function — no OpenCV dependency.
 * Scores each contour by aspect ratio (tall = bottle-like), centered position,
 * and size relative to image dimensions. Returns best contour or null.
 */
export function scoreContours(
  contours: ContourRect[],
  imageWidth: number, imageHeight: number,
): ScoredContour | null {
  const cx = imageWidth / 2;
  const cy = imageHeight / 2;
  const diag = Math.sqrt(imageWidth * imageWidth + imageHeight * imageHeight);
  let best: ScoredContour | null = null;

  for (let i = 0; i < contours.length; i++) {
    const r = contours[i];
    const score = scoreBottleRoi(r, imageWidth, imageHeight, cx, cy, diag);
    if (score > (best?.score ?? -1) && score >= CONTOUR_SCORING_CONFIG.minScoreThreshold) {
      best = { idx: i, score };
    }
  }

  return best;
}

export interface ScoredContours {
  all: Array<{ idx: number; score: number }>;
  best: ScoredContour | null;
}

/**
 * Scores ALL contours and returns top-N (default N=3) sorted by score descending.
 * Still applies the minScoreThreshold filter.
 * Pure function — no OpenCV dependency.
 */
export function scoreContoursTopN(
  contours: ContourRect[],
  imageWidth: number, imageHeight: number,
  n: number = 3,
): ScoredContours {
  const cx = imageWidth / 2;
  const cy = imageHeight / 2;
  const diag = Math.sqrt(imageWidth * imageWidth + imageHeight * imageHeight);

  const scored: Array<{ idx: number; score: number }> = [];

  for (let i = 0; i < contours.length; i++) {
    const r = contours[i];
    const score = scoreBottleRoi(r, imageWidth, imageHeight, cx, cy, diag);

    if (score >= CONTOUR_SCORING_CONFIG.minScoreThreshold) {
      scored.push({ idx: i, score });
    }
  }

  // Sort by score descending
  scored.sort((a, b) => b.score - a.score);

  const topN = scored.slice(0, n);
  const best = topN.length > 0 ? { idx: topN[0].idx, score: topN[0].score } : null;

  return { all: topN, best };
}

export function scoreBottleRoi(
  r: ContourRect,
  imageWidth: number,
  imageHeight: number,
  cx = imageWidth / 2,
  cy = imageHeight / 2,
  diag = Math.sqrt(imageWidth * imageWidth + imageHeight * imageHeight),
): number {
  const aspectRatio = r.h / Math.max(1, r.w);
  const centerX = r.x + r.w / 2;
  const centerY = r.y + r.h / 2;
  const distFromCenter = Math.sqrt((centerX - cx) ** 2 + (centerY - cy) ** 2) / Math.max(1, diag);
  const frameArea = Math.max(1, imageWidth * imageHeight);
  const areaRatio = r.area / frameArea;
  const heightRatio = r.h / Math.max(1, imageHeight);
  const touchesEdge = r.x <= 1 || r.y <= 1 || r.x + r.w >= imageWidth - 1 || r.y + r.h >= imageHeight - 1;

  const aspectScore = triangularScore(aspectRatio, 1.35, 3.1, 6.2);
  const centerScore = Math.max(0, 1 - distFromCenter * 3.2);
  const areaScore = triangularScore(areaRatio, 0.025, 0.16, 0.42);
  const heightScore = triangularScore(heightRatio, 0.22, 0.62, 0.94);
  const sizeScore = areaScore * 0.55 + heightScore * 0.45;
  const edgeClearanceScore = touchesEdge ? 0.25 : 1;
  const frameFillPenalty = areaRatio > 0.5 || (heightRatio > 0.94 && r.w / Math.max(1, imageWidth) > 0.55) ? 0.2 : 0;

  return Math.max(0, Math.min(1,
    aspectScore * CONTOUR_SCORING_CONFIG.aspectWeight
      + centerScore * CONTOUR_SCORING_CONFIG.centerWeight
      + sizeScore * CONTOUR_SCORING_CONFIG.sizeWeight
      + edgeClearanceScore * CONTOUR_SCORING_CONFIG.edgeClearanceWeight
      - frameFillPenalty,
  ));
}

function triangularScore(value: number, min: number, peak: number, max: number): number {
  if (value <= min || value >= max) return 0;
  if (value === peak) return 1;
  if (value < peak) return (value - min) / Math.max(0.0001, peak - min);
  return (max - value) / Math.max(0.0001, max - peak);
}
