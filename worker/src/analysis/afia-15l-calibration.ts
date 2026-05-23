import { BOTTLE_1_5L } from "@afia/shared";

export interface CalibrationPoint {
  /** Meniscus Y position as a ratio inside the detected bottle ROI. */
  yRatioInBottle: number;
  /** Remaining oil fraction for a 1.5L Afia bottle. */
  fillRatio: number;
}

export const AFIA_15L_CALIBRATION_CURVE: CalibrationPoint[] = [
  { yRatioInBottle: 0, fillRatio: 1 },
  { yRatioInBottle: 0.15, fillRatio: 1 },
  { yRatioInBottle: 0.22, fillRatio: 0.9 },
  { yRatioInBottle: 0.34, fillRatio: 0.72 },
  { yRatioInBottle: 0.47, fillRatio: 0.52 },
  { yRatioInBottle: 0.6, fillRatio: 0.32 },
  { yRatioInBottle: 0.72, fillRatio: 0.16 },
  { yRatioInBottle: 0.82, fillRatio: 0.05 },
  { yRatioInBottle: 0.85, fillRatio: 0 },
  { yRatioInBottle: 1, fillRatio: 0 },
];

export function afia15lFillRatioFromMeniscus(yRatioInBottle: number): number {
  const y = clamp(yRatioInBottle, 0, 1);
  for (let i = 1; i < AFIA_15L_CALIBRATION_CURVE.length; i += 1) {
    const prev = AFIA_15L_CALIBRATION_CURVE[i - 1];
    const next = AFIA_15L_CALIBRATION_CURVE[i];
    if (y <= next.yRatioInBottle) {
      const span = Math.max(0.0001, next.yRatioInBottle - prev.yRatioInBottle);
      const t = (y - prev.yRatioInBottle) / span;
      return clamp(prev.fillRatio + (next.fillRatio - prev.fillRatio) * t, 0, 1);
    }
  }
  return 0;
}

export function afia15lRemainingMlFromMeniscus(yRatioInBottle: number): number {
  return Math.round(afia15lFillRatioFromMeniscus(yRatioInBottle) * BOTTLE_1_5L.capacityMl);
}

export function yRatioWithinBottle(liquidLineY: number, bottleTopY: number, bottleBottomY: number): number {
  return clamp((liquidLineY - bottleTopY) / Math.max(1, bottleBottomY - bottleTopY), 0, 1);
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}
