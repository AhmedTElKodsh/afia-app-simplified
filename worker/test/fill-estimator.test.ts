import { describe, expect, it } from "vitest";
import { estimateFillFromEvidence } from "../src/analysis/fill-estimator.js";

describe("estimateFillFromEvidence", () => {
  it("computes 1.5L fill from bounded bottle and liquid-line evidence", () => {
    const result = estimateFillFromEvidence({
      bottleSize: "1.5L",
      evidence: {
        schemaVersion: "afia_visual_evidence_v1",
        bottleDetected: true,
        bottleType: "afia_1_5l",
        bottleTypeConfidence: 0.9,
        topVisible: true,
        bottomVisible: true,
        frontLabelVisible: true,
        liquidBoundaryVisible: true,
        bottleBox: { yMin: 100, xMin: 250, yMax: 900, xMax: 750 },
        liquidLine: {
          kind: "line",
          points: [{ x: 320, y: 500 }, { x: 700, y: 500 }],
        },
        qualityFlags: ["mild_glare"],
        evidenceConfidence: 0.82,
        refusalReason: null,
      },
    });

    expect(result).toMatchObject({
      status: "measured",
      remainingMl: 711,
      consumedMl: 789,
      redLineYRatio: 0.5,
      confidence: 0.82,
      warnings: ["mild_glare"],
    });
  });

  it("refuses 2.5L evidence instead of applying 1.5L math", () => {
    const result = estimateFillFromEvidence({
      bottleSize: "1.5L",
      evidence: {
        schemaVersion: "afia_visual_evidence_v1",
        bottleDetected: true,
        bottleType: "afia_2_5l",
        bottleTypeConfidence: 0.9,
        topVisible: true,
        bottomVisible: true,
        frontLabelVisible: true,
        liquidBoundaryVisible: true,
        bottleBox: { yMin: 100, xMin: 250, yMax: 900, xMax: 750 },
        liquidLine: { kind: "line", points: [{ x: 500, y: 500 }] },
        qualityFlags: [],
        evidenceConfidence: 0.82,
        refusalReason: null,
      },
    });

    expect(result).toMatchObject({
      status: "needs_review",
      remainingMl: null,
      refusalReason: "unsupported_product",
      warnings: expect.arrayContaining(["unsupported_product"]),
    });
  });

  it("routes missing liquid boundaries to review", () => {
    const result = estimateFillFromEvidence({
      bottleSize: "1.5L",
      evidence: {
        schemaVersion: "afia_visual_evidence_v1",
        bottleDetected: true,
        bottleType: "afia_1_5l",
        bottleTypeConfidence: 0.9,
        topVisible: true,
        bottomVisible: true,
        frontLabelVisible: true,
        liquidBoundaryVisible: false,
        bottleBox: null,
        liquidLine: null,
        qualityFlags: ["low_confidence"],
        evidenceConfidence: 0.2,
        refusalReason: "liquid boundary is not visible",
      },
    });

    expect(result).toMatchObject({
      status: "needs_review",
      remainingMl: null,
      refusalReason: "liquid_boundary_not_visible",
      warnings: expect.arrayContaining(["low_confidence"]),
    });
  });
});
