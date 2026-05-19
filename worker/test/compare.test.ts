import { describe, expect, it } from "vitest";
import { compareMl, COMPARATOR_NAME, COMPARATOR_VERSION } from "../src/eval/compare.js";

describe("compareMl (±55ml exact, ±110ml close)", () => {
  it("exact when within ±55ml", () => {
    expect(compareMl(770, 770)).toEqual({ absErrorMl: 0, exactBucketPass: true, closeBucketPass: true });
    expect(compareMl(770, 825)).toEqual({ absErrorMl: 55, exactBucketPass: true, closeBucketPass: true });
    expect(compareMl(770, 715)).toEqual({ absErrorMl: 55, exactBucketPass: true, closeBucketPass: true });
  });
  it("close but not exact at >55..<=110ml", () => {
    expect(compareMl(770, 880)).toEqual({ absErrorMl: 110, exactBucketPass: false, closeBucketPass: true });
  });
  it("miss at >110ml", () => {
    expect(compareMl(770, 1000)).toEqual({ absErrorMl: 230, exactBucketPass: false, closeBucketPass: false });
  });
  it("identifies itself", () => {
    expect(COMPARATOR_NAME).toBe("ml-bucket-tolerance");
    expect(COMPARATOR_VERSION).toBe("1.0.0");
  });
});
