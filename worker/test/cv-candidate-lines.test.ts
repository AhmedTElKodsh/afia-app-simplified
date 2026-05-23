import { describe, expect, it } from "vitest";
import {
  fitRansacHorizontalEvidence,
  proposeLiquidLineCandidates,
  selectBestLiquidLineCandidate,
} from "../src/cv/candidate-lines.js";

describe("liquid-line candidate proposals", () => {
  const bottleRect = { x: 200, y: 100, w: 400, h: 800 };

  it("does not let boundary-adjacent cap/base edges beat plausible fill-band evidence", () => {
    const candidates = proposeLiquidLineCandidates({
      bottleRect,
      edges: [
        { y: 5, strength: 5000, xStart: 20, xEnd: 380 },
        { y: 390, strength: 1600, xStart: 60, xEnd: 340 },
        { y: 760, strength: 3000, xStart: 20, xEnd: 380 },
      ],
      imageWidth: 1000,
      imageHeight: 1000,
    });

    expect(candidates[0]).toMatchObject({
      id: "line-1",
      y: 490,
      yRatioInBottle: 0.4875,
      horizontalCoverage: 0.7,
      reason: "edge_strength+fillable_band+coverage",
    });
    expect(candidates[0].score).toBeGreaterThan(candidates.find((candidate) => candidate.id === "line-0")!.score);
    expect(candidates[0].score).toBeGreaterThan(candidates.find((candidate) => candidate.id === "line-2")!.score);
  });

  it("keeps the top candidates sorted and bounded to the requested count", () => {
    const candidates = proposeLiquidLineCandidates({
      bottleRect,
      topN: 2,
      edges: [
        { y: 220, strength: 600, xStart: 40, xEnd: 360 },
        { y: 320, strength: 1200, xStart: 40, xEnd: 360 },
        { y: 420, strength: 900, xStart: 40, xEnd: 360 },
      ],
      imageWidth: 1000,
      imageHeight: 1000,
    });

    expect(candidates).toHaveLength(2);
    expect(candidates[0].score).toBeGreaterThanOrEqual(candidates[1].score);
    expect(candidates.map((candidate) => candidate.y)).toEqual([420, 520]);
  });

  it("marks missing horizontal coverage as unknown instead of full-width evidence", () => {
    const [candidate] = proposeLiquidLineCandidates({
      bottleRect,
      edges: [{ y: 390, strength: 1600 }],
      imageWidth: 1000,
      imageHeight: 1000,
    });

    expect(candidate.horizontalCoverage).toBeNull();
    expect(candidate.reason).toBe("edge_strength+fillable_band+coverage_unknown");
  });

  it("uses ROI-relative x coverage and clamps invalid topN values", () => {
    const candidates = proposeLiquidLineCandidates({
      bottleRect,
      topN: -1,
      edges: [{ y: 390, strength: 1600, xStart: 100, xEnd: 300 }],
      imageWidth: 1000,
      imageHeight: 1000,
    });

    expect(candidates).toEqual([]);
  });

  it("returns null when no candidate has enough evidence", () => {
    const best = selectBestLiquidLineCandidate(proposeLiquidLineCandidates({
      bottleRect,
      minScore: 0.8,
      edges: [
        { y: 15, strength: 80 },
        { y: 790, strength: 90 },
      ],
      imageWidth: 1000,
      imageHeight: 1000,
    }));

    expect(best).toBeNull();
  });

  it("promotes clustered Hough/Sobel evidence through a RANSAC candidate", () => {
    const ransac = fitRansacHorizontalEvidence([
      { y: 393, strength: 900, source: "sobel_row", xStart: 80, xEnd: 310 },
      { y: 395, strength: 1200, source: "hough_segment", xStart: 70, xEnd: 330, angleDeg: 1.5 },
      { y: 397, strength: 800, source: "sobel_row", xStart: 90, xEnd: 320 },
      { y: 620, strength: 2000, source: "sobel_row", xStart: 40, xEnd: 360 },
    ]);

    expect(ransac).toMatchObject({
      source: "ransac_cluster",
      xStart: 70,
      xEnd: 330,
      inlierCount: 3,
    });
    expect(ransac?.y).toBeGreaterThan(394);
    expect(ransac?.y).toBeLessThan(396);

    const [candidate] = proposeLiquidLineCandidates({
      bottleRect,
      edges: [ransac!],
      imageWidth: 1000,
      imageHeight: 1000,
    });

    expect(candidate).toMatchObject({
      source: "ransac_cluster",
      inlierCount: 3,
      reason: expect.stringContaining("ransac_cluster"),
    });
  });
});
