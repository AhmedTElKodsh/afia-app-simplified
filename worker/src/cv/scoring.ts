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
    const aspectRatio = r.h / Math.max(1, r.w);
    const centerX = r.x + r.w / 2;
    const centerY = r.y + r.h / 2;
    const distFromCenter = Math.sqrt((centerX - cx) ** 2 + (centerY - cy) ** 2) / diag;
    const sizeRatio = Math.sqrt(r.area) / diag;

    const aspectScore = Math.min(1, aspectRatio / 3);
    const centerScore = Math.max(0, 1 - distFromCenter * 3);
    const sizeScore = Math.min(1, sizeRatio * 5);

    const score = aspectScore * 0.5 + centerScore * 0.3 + sizeScore * 0.2;
    if (score > (best?.score ?? -1) && score >= 0.3) {
      best = { idx: i, score };
    }
  }

  return best;
}
