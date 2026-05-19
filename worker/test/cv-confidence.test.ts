import { describe, expect, it } from "vitest";
import { scoreConfidence } from "../src/cv/confidence.js";
import type { ContourResult } from "../src/cv/contour.js";
import { getBottleGeometry } from "../src/cv/geometry.js";

const geometry = getBottleGeometry(1500);

function makeContour(overrides: Partial<ContourResult> = {}): ContourResult {
  return {
    found: true,
    meniscusY: 200,
    meniscusYRatio: 0.5,
    bottleTopY: 50,
    bottleBottomY: 400,
    edgeStrength: 500,
    contourCount: 5,
    geometry,
    ...overrides,
  };
}

describe("scoreConfidence", () => {
  it("returns 0/low for not-found contour", () => {
    const result = scoreConfidence({ ...makeContour(), found: false });
    expect(result.score).toBe(0);
    expect(result.tier).toBe("low");
    expect(result.reasons).toContain("No contour found");
  });

  it("score is in [0, 1]", () => {
    for (const strength of [0, 100, 500, 1000, 2000, 5000]) {
      const result = scoreConfidence(makeContour({ edgeStrength: strength }));
      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.score).toBeLessThanOrEqual(1);
    }
  });

  it("higher edge strength produces higher score", () => {
    const low = scoreConfidence(makeContour({ edgeStrength: 100 }));
    const high = scoreConfidence(makeContour({ edgeStrength: 1000 }));
    expect(high.score).toBeGreaterThan(low.score);
  });

  it("noise penalty reduces score", () => {
    const clean = scoreConfidence(makeContour({ contourCount: 5 }));
    const noisy = scoreConfidence(makeContour({ contourCount: 80 }));
    expect(clean.score).toBeGreaterThan(noisy.score);
  });

  it("extreme ratio penalty fires for near-0 ratio", () => {
    const result = scoreConfidence(makeContour({ meniscusYRatio: 0.01 }));
    expect(result.reasons.some(r => r.includes("Extreme"))).toBe(true);
  });

  it("extreme ratio penalty fires for near-1 ratio", () => {
    const result = scoreConfidence(makeContour({ meniscusYRatio: 0.99 }));
    expect(result.reasons.some(r => r.includes("Extreme"))).toBe(true);
  });

  it("mid ratio has no extreme penalty", () => {
    const result = scoreConfidence(makeContour({ meniscusYRatio: 0.5 }));
    expect(result.reasons.some(r => r.includes("Extreme"))).toBe(false);
  });

  it("tier is high when score >= 0.7", () => {
    const result = scoreConfidence(makeContour({ edgeStrength: 2000 }));
    expect(result.tier).toBe("high");
  });

  it("tier is medium when score between 0.3 and 0.7", () => {
    // edgeStrength=900 → 0.45, contourCount=30 → penalty=0.045, score≈0.405 → medium
    const result = scoreConfidence(makeContour({ edgeStrength: 900, contourCount: 30 }));
    expect(result.tier).toBe("medium");
  });

  it("tier is low when score < 0.3", () => {
    const result = scoreConfidence(makeContour({ edgeStrength: 100, contourCount: 100 }));
    expect(result.tier).toBe("low");
  });
});
