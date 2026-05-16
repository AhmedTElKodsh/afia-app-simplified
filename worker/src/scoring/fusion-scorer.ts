import type { Scorer, ScorerResult } from "./interface.js";

export interface FusionConfig {
  fallbackConfidenceThreshold: number; // if best scorer below this, use fallback
  minScorersRequired: number; // how many must return results
}

const DEFAULT_CONFIG: FusionConfig = {
  fallbackConfidenceThreshold: 0.3,
  minScorersRequired: 1,
};

export class FusionScorer {
  private scorers: Scorer[];
  private config: FusionConfig;
  // We'll store the last per-scorer results so callers can inspect them
  private lastResults: Map<string, ScorerResult> = new Map();

  constructor(scorers: Scorer[], config?: Partial<FusionConfig>) {
    if (scorers.length === 0) throw new Error("FusionScorer needs at least one scorer");
    this.scorers = scorers;
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  async score(imageData: ArrayBuffer): Promise<ScorerResult> {
    const results = await Promise.all(
      this.scorers.map(s =>
        s.score(imageData).catch(
          () =>
            ({
              remainingMl: 0,
              confidence: 0,
              source: s.name as ScorerResult["source"],
              features: {},
              score: 0,
            }) as ScorerResult,
        ),
      ),
    );

    this.lastResults.clear();
    for (const r of results) {
      this.lastResults.set(r.source, r);
    }

    const valid = results.filter(r => r.score >= this.config.fallbackConfidenceThreshold);

    if (valid.length < this.config.minScorersRequired) {
      // Fallback: use the best scorer even below threshold
      const best = results.reduce((a, b) => (a.score > b.score ? a : b));
      return { ...best, features: { ...best.features, _fusionFallback: 1 } };
    }

    // Weighted average by confidence
    const totalWeight = valid.reduce((s, r) => s + r.confidence, 0);
    const weightedMl =
      valid.reduce((s, r) => s + r.remainingMl * r.confidence, 0) / totalWeight;
    const avgConfidence = valid.reduce((s, r) => s + r.confidence, 0) / valid.length;
    const allSources = valid.map(r => r.source).join("+");

    return {
      remainingMl: Math.round(weightedMl * 10) / 10,
      confidence: avgConfidence,
      source: allSources as ScorerResult["source"],
      features: valid.reduce(
        (acc, r) => ({ ...acc, ...r.features }),
        {} as Record<string, number>,
      ),
      score: valid.reduce((s, r) => s + r.score, 0) / valid.length,
    };
  }

  getLastResults(): Map<string, ScorerResult> {
    return new Map(this.lastResults);
  }
}
