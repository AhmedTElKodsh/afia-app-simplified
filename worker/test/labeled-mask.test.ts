import { describe, expect, it } from "vitest";
import { contourFromLabeledMask } from "../src/cv/labeled-mask.js";

describe("labeled mask/keypoint pass", () => {
  it("turns normalized bottle and liquid labels into a measured contour result", () => {
    const result = contourFromLabeledMask({
      schemaVersion: "afia_labeled_mask_v1",
      labelSource: "human_keypoint",
      bottleBox: { xMin: 250, yMin: 100, xMax: 750, yMax: 900 },
      liquidLineYRatioInBottle: 0.5,
      confidence: 0.94,
    }, 1000, 1000, 1500);

    expect(result).toMatchObject({
      found: true,
      meniscusY: 500,
      bottleTopY: 100,
      bottleBottomY: 900,
      selectedLineSource: "labeled_mask",
      measurementState: "measured",
      lineCandidates: [{
        id: "labeled-mask-line",
        y: 500,
        source: "labeled_mask",
        reason: "labeled_human_keypoint",
      }],
    });
    expect(Math.round((result.meniscusYRatio ?? 0) * 1500)).toBe(711);
  });
});
