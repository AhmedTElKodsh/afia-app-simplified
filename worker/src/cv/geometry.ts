import { afia15lFillRatioFromMeniscus } from "../analysis/afia-15l-calibration.js";

export interface BottleGeometry {
  sizeMl: number;
  fillTopY: number;   // Y-ratio at bottle shoulder (empty)
  fillBottomY: number; // Y-ratio at bottle base (full)
}

const GEOMETRY: Record<number, BottleGeometry> = {
  1500: { sizeMl: 1500, fillTopY: 0.15, fillBottomY: 0.85 },
};

const DEFAULT_GEOMETRY: BottleGeometry = { sizeMl: 1500, fillTopY: 0.15, fillBottomY: 0.85 };

export function getBottleGeometry(sizeMl: number): BottleGeometry {
  return GEOMETRY[sizeMl] ?? DEFAULT_GEOMETRY;
}

export function isSupportedBottle(sizeMl: number): boolean {
  return sizeMl in GEOMETRY;
}

export function calibrateFillRatio(
  meniscusYRatio: number,
  geometry: BottleGeometry,
): number {
  const clamped = Math.max(0, Math.min(1, meniscusYRatio));
  if (geometry.sizeMl === 1500) {
    return afia15lFillRatioFromMeniscus(clamped);
  }
  const raw = 1 - (clamped - geometry.fillTopY) / (geometry.fillBottomY - geometry.fillTopY);
  return Math.max(0, Math.min(1, raw));
}
