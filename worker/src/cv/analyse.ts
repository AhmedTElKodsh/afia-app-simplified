import { cv } from "./index.js";

export interface AnalyseResult {
  mean: number;
  stdDev: number;
}

/**
 * Compute mean and standard deviation of a single-channel (grayscale) image.
 */
export function analyse(gray: any): AnalyseResult {
  const mean = new cv.Mat();
  const stdDev = new cv.Mat();

  try {
    cv.meanStdDev(gray, mean, stdDev);
    const meanVal = mean.data64F[0];
    const stdVal = stdDev.data64F[0];
    return { mean: meanVal, stdDev: stdVal };
  } finally {
    mean.delete();
    stdDev.delete();
  }
}

export function freeAnalysis(r: AnalyseResult): void {
  // No-op — results are scalar values, not OpenCV mats
}
