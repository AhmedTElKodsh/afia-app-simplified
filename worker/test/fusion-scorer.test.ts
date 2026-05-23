import { describe, expect, it, vi } from "vitest";
import { FusionScorer } from "../src/scoring/fusion-scorer.js";
import type { Scorer, ScorerResult } from "../src/scoring/interface.js";

const imageData = new ArrayBuffer(8);

function result(
  source: string,
  remainingMl: number,
  confidence: number,
  score = confidence,
  features: Record<string, number> = {},
): ScorerResult {
  return {
    source,
    remainingMl,
    confidence,
    score,
    features,
  };
}

function scorer(name: string, scorerResult: ScorerResult): Scorer {
  return {
    name,
    score: vi.fn(async () => scorerResult),
  };
}

function throwingScorer(name: string, error = new Error("scorer unavailable")): Scorer {
  return {
    name,
    score: vi.fn(async () => {
      throw error;
    }),
  };
}

describe("FusionScorer contract", () => {
  it("caps confidence when only one signal survives so weak fusion cannot look release-grade", async () => {
    const fusion = new FusionScorer([
      scorer("heuristic", result("heuristic", 92, 0.95, 0.95)),
      scorer("onnx", result("onnx", 0, 0.95, 0.95)),
    ]);

    const fused = await fusion.score(imageData);

    expect(fused.remainingMl).toBeGreaterThan(80);
    expect(fused.confidence).toBeLessThanOrEqual(0.29);
    expect(fused.features._fusionReason_singleValidSignal).toBe(1);
    expect(fused.features._fusionSingleSignalConfidenceCap).toBe(0.29);
  });

  it("increases trust when heuristic and ONNX agree", async () => {
    const fusion = new FusionScorer([
      scorer("heuristic", result("heuristic", 72, 0.62, 0.62)),
      scorer("onnx", result("onnx", 70, 0.7, 0.7)),
    ]);

    const fused = await fusion.score(imageData);

    expect(fused.source).toContain("heuristic");
    expect(fused.source).toContain("onnx");
    expect(fused.remainingMl).toBeCloseTo(71, 0);
    expect(fused.confidence).toBeGreaterThan(0.7);
    expect(fused.features._fusionStage).toBe(1);
    expect(fused.features._fusionSignal_heuristic_confidence).toBeCloseTo(0.62);
    expect(fused.features._fusionSignal_onnx_confidence).toBeCloseTo(0.7);
    expect(fused.features._fusionSignal_heuristic_weight).toBeGreaterThan(0);
    expect(fused.features._fusionSignal_onnx_weight).toBeGreaterThan(0);
  });

  it("down-weights near-zero ONNX from S09 instead of averaging the heuristic toward zero", async () => {
    const fusion = new FusionScorer([
      scorer("heuristic", result("heuristic", 92, 0.78, 0.78)),
      scorer("onnx", result("onnx", 0, 0.95, 0.95)),
    ]);

    const fused = await fusion.score(imageData);

    expect(fused.remainingMl).toBeGreaterThan(80);
    expect(fused.confidence).toBeLessThanOrEqual(0.29);
    expect(fused.features._fusionIgnored_onnx_nearZeroEstimate).toBe(1);
    expect(fused.features._fusionSignal_onnx_weight).toBe(0);
  });

  it("penalizes large heuristic-vs-ONNX disagreement and records a reason", async () => {
    const fusion = new FusionScorer([
      scorer("heuristic", result("heuristic", 98, 0.82, 0.82)),
      scorer("onnx", result("onnx", 8, 0.77, 0.77)),
    ]);

    const fused = await fusion.score(imageData);

    expect(fused.confidence).toBeLessThan(0.77);
    expect(fused.features._fusionDisagreementPenalty).toBeGreaterThan(0);
    expect(fused.features._fusionReason_conflictingFullVsEmpty).toBe(1);
    expect(fused.features._fusionSignal_heuristic_estimateMl).toBe(98);
    expect(fused.features._fusionSignal_onnx_estimateMl).toBe(8);
  });

  it("allows an optional LLM signal to participate when present", async () => {
    const fusion = new FusionScorer([
      scorer("heuristic", result("heuristic", 64, 0.6, 0.6)),
      scorer("onnx", result("onnx", 66, 0.64, 0.64)),
      scorer("llm", result("llm", 70, 0.72, 0.72)),
    ]);

    const fused = await fusion.score(imageData);

    expect(fused.source).toContain("llm");
    expect(fused.remainingMl).toBeGreaterThan(64);
    expect(fused.remainingMl).toBeLessThan(70);
    expect(fused.features._fusionSignal_llm_confidence).toBeCloseTo(0.72);
    expect(fused.features._fusionSignal_llm_weight).toBeGreaterThan(0);
  });

  it("does not treat a missing optional LLM scorer as an error", async () => {
    const fusion = new FusionScorer([
      scorer("heuristic", result("heuristic", 64, 0.6, 0.6)),
      scorer("onnx", result("onnx", 66, 0.64, 0.64)),
    ]);

    const fused = await fusion.score(imageData);

    expect(fused.source).not.toContain("llm");
    expect(fused.features._fusionMissing_llm).toBeUndefined();
    expect(fused.features._fusionFailed_llm).toBeUndefined();
  });

  it.each([
    ["non-finite confidence", result("onnx", 70, Number.NaN, 0.8), "_fusionIgnored_onnx_invalidConfidence"],
    ["non-finite remainingMl", result("onnx", Number.POSITIVE_INFINITY, 0.8, 0.8), "_fusionIgnored_onnx_invalidEstimate"],
    ["negative confidence", result("onnx", 70, -0.1, 0.8), "_fusionIgnored_onnx_invalidConfidence"],
    ["confidence above one", result("onnx", 70, 1.1, 0.8), "_fusionIgnored_onnx_invalidConfidence"],
    ["null-like malformed estimate", { ...result("onnx", 70, 0.8, 0.8), remainingMl: null as unknown as number }, "_fusionIgnored_onnx_invalidEstimate"],
  ])("ignores malformed signals with diagnostics: %s", async (_label, badResult, reasonKey) => {
    const fusion = new FusionScorer([
      scorer("heuristic", result("heuristic", 74, 0.76, 0.76)),
      scorer("onnx", badResult),
    ]);

    const fused = await fusion.score(imageData);

    expect(fused.remainingMl).toBeCloseTo(74, 1);
    expect(fused.confidence).toBeLessThanOrEqual(0.29);
    expect(fused.features[reasonKey]).toBe(1);
    expect(fused.features._fusionSignal_onnx_weight).toBe(0);
  });

  it("captures a thrown scorer and continues when enough valid signals remain", async () => {
    const fusion = new FusionScorer([
      scorer("heuristic", result("heuristic", 74, 0.76, 0.76)),
      throwingScorer("onnx"),
      scorer("llm", result("llm", 77, 0.66, 0.66)),
    ]);

    const fused = await fusion.score(imageData);

    expect(fused.remainingMl).toBeGreaterThan(73);
    expect(fused.remainingMl).toBeLessThan(78);
    expect(fused.confidence).toBeGreaterThan(0.5);
    expect(fused.features._fusionFailed_onnx).toBe(1);
    expect(fused.features._fusionIgnored_onnx_exception).toBe(1);
    expect(fused.features._fusionValidSignalCount).toBe(2);
  });

  it("returns a low-confidence fallback with reasons when all sources fail", async () => {
    const fusion = new FusionScorer([
      throwingScorer("heuristic"),
      throwingScorer("onnx"),
    ]);

    const fused = await fusion.score(imageData);

    expect(fused.confidence).toBeLessThanOrEqual(0.3);
    expect(fused.score).toBeLessThanOrEqual(0.3);
    expect(fused.features._fusionFallback).toBe(1);
    expect(fused.features._fusionFailed_heuristic).toBe(1);
    expect(fused.features._fusionFailed_onnx).toBe(1);
    expect(fused.features._fusionValidSignalCount).toBe(0);
    expect(fused.features._fusionReason_noValidSignals).toBe(1);
  });
});
