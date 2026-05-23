import { describe, expect, it } from "vitest";
import { buildOverlayHarnessRecord, stageMetricsFromPipeline } from "../src/eval/overlay-harness.js";
import type { PipelineOutput } from "../src/cv/pipeline.js";

function pipeline(): PipelineOutput {
  return {
    success: true,
    fillRatio: 0.48,
    category: "Half",
    confidence: 0.66,
    tier: "medium",
    errors: [],
    diagnostics: {
      contourFound: true,
      meniscusY: 420,
      bottleRect: { x: 120, y: 80, w: 300, h: 720 },
      lineCandidates: [{
        id: "line-0",
        y: 420,
        yRatioInBottle: 0.47,
        score: 0.82,
        edgeStrength: 1600,
        horizontalCoverage: 0.74,
        source: "ransac_cluster",
        angleDeg: 0,
        inlierCount: 4,
        reason: "edge_strength+fillable_band+coverage+ransac_cluster",
      }],
      selectedLineSource: "candidate",
      measurementState: "measured",
      edgeStrength: 1600,
      stages: ["validate", "preprocess", "contour", "confidence", "fusion", "complete"],
      fusion: {
        source: "heuristic",
        confidence: 0.61,
        score: 0.61,
        remainingMl: 720,
        features: {},
      },
    },
  };
}

describe("overlay harness", () => {
  it("turns pipeline diagnostics into stage metrics for overlay review", () => {
    expect(stageMetricsFromPipeline(pipeline())).toMatchObject({
      success: true,
      tier: "medium",
      contourFound: true,
      measurementState: "measured",
      selectedLineSource: "candidate",
      candidateCount: 1,
      bestCandidateScore: 0.82,
      fusionSource: "heuristic",
    });
  });

  it("keeps overlay records free of image payloads", () => {
    const record = buildOverlayHarnessRecord({
      imageId: "sample.jpg",
      imagePath: "fixtures/sample.jpg",
      groundTruthMl: 700,
      bottleSizeMl: 1500,
      result: pipeline(),
    });

    expect(record).toMatchObject({
      imageId: "sample.jpg",
      predictedMl: 720,
      absErrorMl: 20,
    });
    expect(JSON.stringify(record)).not.toContain("base64");
  });
});
