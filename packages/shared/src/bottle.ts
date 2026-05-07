export type BottleSize = "1.5L" | "2.5L";

export const BOTTLE_1_5L = {
  size: "1.5L" as const,
  capacityMl: 1500,
  fillTopY: 0.18,
  fillBottomY: 0.96,
} as const;

export const BOTTLE_2_5L = {
  size: "2.5L" as const,
  capacityMl: 2500,
  fillTopY: 0.16,
  fillBottomY: 0.97,
} as const;

export const ML_PER_CUP_QUARTER = 55;
export const ML_PER_CUP = ML_PER_CUP_QUARTER * 4;
