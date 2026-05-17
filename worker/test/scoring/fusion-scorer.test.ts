import { describe, expect, it } from "vitest";
import { FusionScorer } from "../../src/scoring/fusion-scorer.js";
import type { Scorer, ScorerResult } from "../../src/scoring/interface.js";

class MockScorer implements Scorer {
  constructor(
    readonly name: string,
    private result: ScorerResult,
  ) {}
  async score(): Promise<ScorerResult> {
    return this.result;
  }
}

describe("FusionScorer", () => {
  it("requires at least one scorer", () => {
    expect(() => new FusionScorer([])).toThrow("at least one scorer");
  });

  it("returns single scorer result directly", async () => {
    const s = new MockScorer("heuristic", {
      remainingMl: 500,
      confidence: 0.8,
      source: "heuristic",
      features: {},
      score: 0.8,
    });
    const fusion = new FusionScorer([s]);
    const result = await fusion.score(new ArrayBuffer(0));
    expect(result.remainingMl).toBe(500);
    expect(result.source).toBe("heuristic");
  });

  it("weights two scorers by confidence", async () => {
    const s1 = new MockScorer("heuristic", {
      remainingMl: 400,
      confidence: 0.9,
      source: "heuristic",
      features: {},
      score: 0.9,
    });
    const s2 = new MockScorer("onnx", {
      remainingMl: 500,
      confidence: 0.1,
      source: "onnx",
      features: {},
      score: 0.5, // above fallbackConfidenceThreshold (0.3) to be included
    });
    const fusion = new FusionScorer([s1, s2]);
    const result = await fusion.score(new ArrayBuffer(0));
    // s2 has very low confidence and a lower ONNX base weight, so result stays close to s1.
    expect(result.remainingMl).toBeCloseTo(403.3, 1);
    expect(result.source).toBe("heuristic+onnx");
  });

  it("falls back below confidence threshold", async () => {
    const low = new MockScorer("low", {
      remainingMl: 0,
      confidence: Number.NaN,
      source: "heuristic",
      features: {},
      score: 0.1,
    });
    const fusion = new FusionScorer([low], { fallbackConfidenceThreshold: 0.3 });
    const result = await fusion.score(new ArrayBuffer(0));
    expect(result.features._fusionFallback).toBe(1);
  });

  it("handles scorer failure gracefully", async () => {
    const failing = new MockScorer("failing", {
      remainingMl: 100,
      confidence: 0.5,
      source: "failing",
      features: {},
      score: 0.5,
    });
    const badScorer: Scorer = {
      name: "bad",
      async score(): Promise<ScorerResult> {
        throw new Error("runtime failure");
      },
    };
    const fusion = new FusionScorer([failing, badScorer]);
    const result = await fusion.score(new ArrayBuffer(0));
    // failing scorer should dominate; bad scorer returns 0-level fallback
    expect(result.remainingMl).toBeCloseTo(100, -1);
  });

  it("getLastResults returns per-scorer results", async () => {
    const s1 = new MockScorer("alpha", {
      remainingMl: 100,
      confidence: 0.9,
      source: "alpha",
      features: { a: 1 },
      score: 0.9,
    });
    const s2 = new MockScorer("beta", {
      remainingMl: 200,
      confidence: 0.8,
      source: "beta",
      features: { b: 2 },
      score: 0.8,
    });
    const fusion = new FusionScorer([s1, s2]);
    await fusion.score(new ArrayBuffer(0));

    const last = fusion.getLastResults();
    expect(last.size).toBe(2);
    expect(last.get("alpha")?.remainingMl).toBe(100);
    expect(last.get("beta")?.remainingMl).toBe(200);
  });

  it("merges features from multiple scorers", async () => {
    const s1 = new MockScorer("a", {
      remainingMl: 300,
      confidence: 0.9,
      source: "a",
      features: { edgeStrength: 500, fillRatio: 0.5 },
      score: 0.9,
    });
    const s2 = new MockScorer("b", {
      remainingMl: 350,
      confidence: 0.85,
      source: "b",
      features: { contourScore: 0.7, confidence: 0.85 },
      score: 0.85,
    });
    const fusion = new FusionScorer([s1, s2]);
    const result = await fusion.score(new ArrayBuffer(0));
    expect(result.features.edgeStrength).toBe(500);
    expect(result.features.contourScore).toBe(0.7);
  });

  it("minScorersRequired rejects insufficient threshold-crossing scorers", async () => {
    const low1 = new MockScorer("low1", {
      remainingMl: 0,
      confidence: Number.NaN,
      source: "low1",
      features: {},
      score: 0.1,
    });
    const low2 = new MockScorer("low2", {
      remainingMl: 0,
      confidence: 0.2,
      source: "low2",
      features: {},
      score: Number.NaN,
    });
    const fusion = new FusionScorer([low1, low2], {
      fallbackConfidenceThreshold: 0.3,
      minScorersRequired: 2,
    });
    const result = await fusion.score(new ArrayBuffer(0));
    // Invalid signals leave fewer than minScorersRequired valid signals, so fallback triggers
    expect(result.features._fusionFallback).toBe(1);
  });
});
