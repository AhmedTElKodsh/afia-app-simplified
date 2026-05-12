export type BottleSize = "1.5L" | "2.5L";

export const DEFAULT_BOTTLE_SIZE: BottleSize = "1.5L";
export const SUPPORTED_BOTTLE_SIZES = ["1.5L", "2.5L"] as const;
export const ANALYSIS_SUPPORTED_BOTTLE_SIZES = ["1.5L"] as const;

export const BOTTLE_1_5L = {
  size: "1.5L" as const,
  capacityMl: 1500,
  fillTopY: 0.18,
  fillBottomY: 0.96,
  mlStep: 55,
  supportedForAnalysis: true,
} as const;

export const BOTTLE_2_5L = {
  size: "2.5L" as const,
  capacityMl: 2500,
  fillTopY: 0.16,
  fillBottomY: 0.97,
  mlStep: 55,
  supportedForAnalysis: false,
} as const;

export const BOTTLE_SPECS = {
  "1.5L": BOTTLE_1_5L,
  "2.5L": BOTTLE_2_5L,
} as const;

export const ML_PER_CUP_QUARTER = 55;
export const ML_PER_CUP = ML_PER_CUP_QUARTER * 4;
export const EXACT_TOLERANCE_ML = 55;
export const CLOSE_TOLERANCE_ML = 110;

export function getBottleSpec(size: BottleSize) {
  return BOTTLE_SPECS[size];
}

export function isSupportedAnalysisSize(size: BottleSize): boolean {
  return BOTTLE_SPECS[size].supportedForAnalysis;
}
