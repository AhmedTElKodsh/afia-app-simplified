import { runPipeline } from "../cv/pipeline.js";
import type { Scorer, ScorerResult } from "./interface.js";

export interface HeuristicScorerOptions {
  bottleSizeMl?: number;
}

export class HeuristicScorer implements Scorer {
  readonly name = "heuristic";
  private bottleSizeMl: number;

  constructor(options?: HeuristicScorerOptions) {
    this.bottleSizeMl = options?.bottleSizeMl ?? 1500;
  }

  async score(imageData: ArrayBuffer): Promise<ScorerResult> {
    const result = await runPipeline({
      imageData,
      bottleSizeMl: this.bottleSizeMl,
    });

    const features: Record<string, number> = {
      edgeStrength: result.diagnostics.edgeStrength,
      fillRatio: result.fillRatio ?? 0,
    };

    return {
      remainingMl: Math.round((result.fillRatio ?? 0) * this.bottleSizeMl * 10) / 10,
      confidence: result.confidence,
      source: "heuristic",
      features,
      score: result.confidence, // confidence IS the quality score for heuristic
    };
  }
}
