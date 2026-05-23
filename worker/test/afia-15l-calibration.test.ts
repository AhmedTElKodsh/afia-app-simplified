import { describe, expect, it } from "vitest";
import { afia15lFillRatioFromMeniscus, afia15lRemainingMlFromMeniscus } from "../src/analysis/afia-15l-calibration.js";

describe("Afia 1.5L calibration curve", () => {
  it("maps shoulder and base regions nonlinearly instead of using raw linear height", () => {
    expect(afia15lRemainingMlFromMeniscus(0.15)).toBe(1500);
    expect(afia15lRemainingMlFromMeniscus(0.5)).toBeLessThan(750);
    expect(afia15lRemainingMlFromMeniscus(0.5)).toBeGreaterThan(650);
    expect(afia15lRemainingMlFromMeniscus(0.85)).toBe(0);
  });

  it("keeps fill ratio bounded outside the measured ROI", () => {
    expect(afia15lFillRatioFromMeniscus(-0.5)).toBe(1);
    expect(afia15lFillRatioFromMeniscus(1.5)).toBe(0);
  });
});
