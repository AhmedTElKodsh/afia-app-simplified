import { EXACT_TOLERANCE_ML, CLOSE_TOLERANCE_ML } from "@afia/shared";

export const COMPARATOR_NAME = "ml-bucket-tolerance";
export const COMPARATOR_VERSION = "1.0.0";

export function compareMl(predicted: number, groundTruth: number) {
  const absErrorMl = Math.abs(predicted - groundTruth);
  return {
    absErrorMl,
    exactBucketPass: absErrorMl <= EXACT_TOLERANCE_ML,
    closeBucketPass: absErrorMl <= CLOSE_TOLERANCE_ML,
  };
}
