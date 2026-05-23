import { describe, expect, it } from "vitest";
import { calibrateFillRatio, getBottleGeometry, isSupportedBottle } from "../src/cv/geometry.js";

const geometry = getBottleGeometry(1500);

describe("calibrateFillRatio", () => {
  it("clamps input to [0, 1] before calibration", () => {
    // -0.5 → clamped to 0 → calibrate to 1.0 (empty)
    expect(calibrateFillRatio(-0.5, geometry)).toBe(1);
    // 1.5 → clamped to 1 → calibrate to 0.0 (full)
    expect(calibrateFillRatio(1.5, geometry)).toBe(0);
  });

  it("returns full for ratio at fillTopY", () => {
    const result = calibrateFillRatio(0.15, geometry);
    expect(result).toBeCloseTo(1.0, 5);
  });

  it("returns empty for ratio at fillBottomY", () => {
    const result = calibrateFillRatio(0.85, geometry);
    expect(result).toBeCloseTo(0.0, 5);
  });

  it("uses the 1.5L profile curve at the mid-range ratio", () => {
    const mid = (0.15 + 0.85) / 2;
    const result = calibrateFillRatio(mid, geometry);
    expect(result).toBeCloseTo(0.4738, 4);
  });

  it("never returns outside [0, 1]", () => {
    for (const input of [-2, -1, -0.1, 0, 0.3, 0.5, 0.7, 1, 1.1, 2]) {
      const result = calibrateFillRatio(input, geometry);
      expect(result).toBeGreaterThanOrEqual(0);
      expect(result).toBeLessThanOrEqual(1);
    }
  });
});

describe("getBottleGeometry", () => {
  it("returns 1500ml geometry for supported size", () => {
    const g = getBottleGeometry(1500);
    expect(g.sizeMl).toBe(1500);
    expect(g.fillTopY).toBe(0.15);
    expect(g.fillBottomY).toBe(0.85);
  });

  it("returns default geometry for unsupported size", () => {
    const g = getBottleGeometry(500);
    expect(g.sizeMl).toBe(1500);
  });
});

describe("isSupportedBottle", () => {
  it("returns true for 1500ml", () => {
    expect(isSupportedBottle(1500)).toBe(true);
  });

  it("returns false for unsupported sizes", () => {
    expect(isSupportedBottle(500)).toBe(false);
    expect(isSupportedBottle(0)).toBe(false);
    expect(isSupportedBottle(2000)).toBe(false);
  });
});
