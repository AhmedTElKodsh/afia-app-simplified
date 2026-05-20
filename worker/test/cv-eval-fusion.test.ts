import { describe, expect, it } from "vitest";
import { rowFromPipelineResult, summarizeCvEval } from "../src/eval/cv-eval.js";
import type { PipelineOutput } from "../src/cv/pipeline.js";

function pipeline(overrides: Partial<PipelineOutput> = {}): PipelineOutput {
  return {
    success: true,
    fillRatio: 0.52,
    category: "Half",
    confidence: 0.72,
    tier: "medium",
    errors: [],
    diagnostics: {
      contourFound: true,
      meniscusY: 100,
      edgeStrength: 0.8,
      stages: ["validate", "preprocess", "contour", "confidence", "fusion", "complete"],
      onnxScore: 0.1,
      onnxLoadStatus: "loaded (4ms)",
      heuristicConfidence: 0.74,
      fusion: {
        source: "heuristic",
        confidence: 0.68,
        score: 0.68,
        remainingMl: 780,
        features: {
          _fusionStage: 1,
          _fusionSignal_heuristic_estimateMl: 765,
          _fusionSignal_heuristic_confidence: 0.74,
          _fusionSignal_heuristic_weight: 0.74,
          _fusionSignal_onnx_estimateMl: 150,
          _fusionSignal_onnx_confidence: 0.1,
          _fusionSignal_onnx_weight: 0,
          _fusionIgnored_onnx_nearZeroEstimate: 1,
          _fusionDisagreementPenalty: 0.18,
          _fusionValidSignalCount: 1,
        },
      },
    },
    ...overrides,
  };
}

describe("CV eval fusion reporting", () => {
  it("projects per-row fusion diagnostics without image payloads or NaN metrics", () => {
    const row = rowFromPipelineResult("sample.jpg", 800, pipeline());

    expect(row).toMatchObject({
      imageId: "sample.jpg",
      fusionSource: "heuristic",
      fusionConfidence: 0.68,
      fusionTier: "medium",
      fusionRemainingMl: 780,
      fusionDisagreementPenalty: 0.18,
      fusionValidSignalCount: 1,
      fusionSignalPresence: { heuristic: true, onnx: true, llm: false },
      fusionIgnoredReasons: { onnx: ["nearZeroEstimate"] },
      onnxHeuristicDeltaMl: 615,
      onnxLoadStatus: "loaded (4ms)",
    });
    expect(JSON.stringify(row)).not.toContain("base64");
    expect(Object.values(row).some(v => typeof v === "number" && Number.isNaN(v))).toBe(false);
  });

  it("summarizes fusion counts and tolerates older or failed rows with missing diagnostics", () => {
    const rows = [
      rowFromPipelineResult("with-fusion.jpg", 800, pipeline()),
      rowFromPipelineResult("old-row.jpg", 0, pipeline({
        success: false,
        fillRatio: null,
        category: null,
        confidence: 0,
        tier: "low",
        diagnostics: {
          contourFound: false,
          meniscusY: null,
          edgeStrength: 0,
          stages: ["validate"],
          onnxLoadStatus: "fail: missing model",
        },
      })),
    ];

    const summary = summarizeCvEval(rows, 198);

    expect(summary.manifestCount).toBe(198);
    expect(summary.evaluatedCount).toBe(2);
    expect(summary.fusion.sourceCounts).toEqual({ heuristic: 1, missing: 1 });
    expect(summary.fusion.ignoredReasonCounts).toEqual({ "onnx:nearZeroEstimate": 1 });
    expect(summary.fusion.disagreementPenaltyBuckets).toEqual({ "0.1-0.25": 1, missing: 1 });
    expect(summary.fusion.tierDistribution).toEqual({ medium: 1, missing: 1 });
    expect(summary.fusion.onnxHeuristicDeltaMl).toEqual({ count: 1, avg: 615, max: 615 });
    expect(summary.quality).toMatchObject({
      meanSignedErrorMl: -20,
      meanAbsErrorMl: 20,
      maxAbsErrorMl: 20,
      highConfidenceWrongCount: 0,
      errorBuckets: { "0-55": 1, missing: 1 },
      groundTruthBands: {
        mid: { count: 1, exactPct: 100, closePct: 100, meanSignedErrorMl: -20 },
        empty: { count: 1, exactPct: 0, closePct: 0, meanSignedErrorMl: null },
      },
    });
    expect(JSON.stringify(summary)).not.toContain("NaN");
  });
});
