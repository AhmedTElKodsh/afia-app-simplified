import { describe, expect, it } from "vitest";
import { chooseSegmentationPrototype, summarizeBinaryMasks } from "../src/onnx/segmentation-prototype.js";

describe("segmentation prototype contract", () => {
  it("defaults to a compact U-Net shaped for ONNX Runtime Web", () => {
    expect(chooseSegmentationPrototype()).toMatchObject({
      kind: "compact_unet",
      targetRuntime: "onnxruntime-web",
      inputShape: [1, 3, 256, 256],
      outputNames: ["bottle_mask", "liquid_mask"],
    });
  });

  it("summarizes bottle and liquid masks into ROI evidence", () => {
    const width = 5;
    const height = 5;
    const bottle = new Float32Array(width * height);
    const liquid = new Float32Array(width * height);
    for (let y = 1; y <= 4; y += 1) {
      for (let x = 1; x <= 3; x += 1) bottle[y * width + x] = 1;
    }
    for (let y = 3; y <= 4; y += 1) {
      for (let x = 1; x <= 3; x += 1) liquid[y * width + x] = 1;
    }

    expect(summarizeBinaryMasks({ width, height, bottleMask: bottle, liquidMask: liquid })).toMatchObject({
      bottleBox: { xMin: 1, yMin: 1, xMax: 3, yMax: 4 },
      liquidBox: { xMin: 1, yMin: 3, xMax: 3, yMax: 4 },
      bottleAreaRatio: 0.48,
      liquidAreaRatio: 0.24,
      liquidYRatioInBottle: 0.6667,
    });
  });
});
