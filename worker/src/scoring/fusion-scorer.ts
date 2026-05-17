import type { Scorer, ScorerResult, ScorerSource } from "./interface.js";

export interface FusionConfig {
  fallbackConfidenceThreshold: number; // if best scorer below this, use fallback
  minScorersRequired: number; // how many valid weighted signals are required
  maxReasonableRemainingMl: number;
  nearZeroOnnxMl: number;
  weakOnnxHeuristicMl: number;
  disagreementMl: number;
}

const DEFAULT_CONFIG: FusionConfig = {
  fallbackConfidenceThreshold: 0.3,
  minScorersRequired: 1,
  maxReasonableRemainingMl: 500,
  nearZeroOnnxMl: 5,
  weakOnnxHeuristicMl: 40,
  disagreementMl: 50,
};

const SOURCE_BASE_WEIGHTS: Record<string, number> = {
  heuristic: 1,
  onnx: 0.55,
  llm: 0.85,
};

interface CapturedResult {
  source: ScorerSource;
  result?: ScorerResult;
  failed: boolean;
}

interface AcceptedSignal {
  source: ScorerSource;
  remainingMl: number;
  confidence: number;
  score: number;
  weight: number;
  features: Record<string, number>;
}

export class FusionScorer {
  private scorers: Scorer[];
  private config: FusionConfig;
  // Store the last per-scorer results so callers can inspect individual scorer output.
  private lastResults: Map<string, ScorerResult> = new Map();

  constructor(scorers: Scorer[], config?: Partial<FusionConfig>) {
    if (scorers.length === 0) throw new Error("FusionScorer needs at least one scorer");
    this.scorers = scorers;
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  async score(imageData: ArrayBuffer): Promise<ScorerResult> {
    const captured = await Promise.all(this.scorers.map(s => this.captureScore(s, imageData)));

    this.lastResults.clear();
    const features: Record<string, number> = { _fusionStage: 1 };
    const accepted: AcceptedSignal[] = [];

    for (const item of captured) {
      if (item.failed || !item.result) {
        features[`_fusionFailed_${item.source}`] = 1;
        features[`_fusionIgnored_${item.source}_exception`] = 1;
        features[`_fusionSignal_${item.source}_weight`] = 0;
        continue;
      }

      const normalized = this.normalize(item.result, features);
      this.lastResults.set(item.source, item.result);
      if (normalized) accepted.push(normalized);
    }

    this.applyWeakOnnxSuppression(accepted, features);
    const valid = accepted.filter(signal => signal.weight > 0);
    features._fusionValidSignalCount = valid.length;

    if (valid.length < this.config.minScorersRequired) {
      return this.fallback(features, captured, "noValidSignals");
    }

    const totalWeight = valid.reduce((sum, signal) => sum + signal.weight, 0);
    if (!Number.isFinite(totalWeight) || totalWeight <= 0) {
      return this.fallback(features, captured, "zeroTotalWeight");
    }

    const weightedMl = valid.reduce((sum, signal) => sum + signal.remainingMl * signal.weight, 0) / totalWeight;
    const weightedConfidence =
      valid.reduce((sum, signal) => sum + signal.confidence * signal.weight, 0) / totalWeight;
    const weightedScore = valid.reduce((sum, signal) => sum + signal.score * signal.weight, 0) / totalWeight;
    const disagreementPenalty = this.disagreementPenalty(valid, features);
    const confidenceBoost = valid.length > 1 && disagreementPenalty === 0 ? 0.08 : 0;
    const confidence = clamp01(weightedConfidence + confidenceBoost - disagreementPenalty);
    const score = clamp01(weightedScore + confidenceBoost - disagreementPenalty);

    return {
      remainingMl: round1(weightedMl),
      confidence,
      source: valid.map(signal => signal.source).join("+") as ScorerSource,
      features: {
        ...valid.reduce((acc, signal) => ({ ...acc, ...signal.features }), {} as Record<string, number>),
        ...features,
        _fusionTotalWeight: round3(totalWeight),
        _fusionDisagreementPenalty: round3(disagreementPenalty),
      },
      score,
    };
  }

  getLastResults(): Map<string, ScorerResult> {
    return new Map(this.lastResults);
  }

  private async captureScore(scorer: Scorer, imageData: ArrayBuffer): Promise<CapturedResult> {
    const source = scorer.name as ScorerSource;
    try {
      const result = await scorer.score(imageData);
      return { source: result?.source ?? source, result, failed: false };
    } catch {
      return { source, failed: true };
    }
  }

  private normalize(result: ScorerResult, features: Record<string, number>): AcceptedSignal | undefined {
    const source = result.source as ScorerSource;
    features[`_fusionSignal_${source}_estimateMl`] = Number(result.remainingMl);
    features[`_fusionSignal_${source}_confidence`] = Number(result.confidence);
    features[`_fusionSignal_${source}_score`] = Number(result.score);

    if (!isFiniteNumber(result.remainingMl) || result.remainingMl < 0 || result.remainingMl > this.config.maxReasonableRemainingMl) {
      features[`_fusionIgnored_${source}_invalidEstimate`] = 1;
      features[`_fusionSignal_${source}_weight`] = 0;
      return undefined;
    }

    if (!isFiniteNumber(result.confidence) || result.confidence < 0 || result.confidence > 1) {
      features[`_fusionIgnored_${source}_invalidConfidence`] = 1;
      features[`_fusionSignal_${source}_weight`] = 0;
      return undefined;
    }

    if (!isFiniteNumber(result.score) || result.score < 0 || result.score > 1) {
      features[`_fusionIgnored_${source}_invalidScore`] = 1;
      features[`_fusionSignal_${source}_weight`] = 0;
      return undefined;
    }

    const baseWeight = SOURCE_BASE_WEIGHTS[source] ?? 0.5;
    const weight = round3(baseWeight * result.confidence * result.score);
    features[`_fusionSignal_${source}_weight`] = weight;

    return {
      source,
      remainingMl: result.remainingMl,
      confidence: result.confidence,
      score: result.score,
      weight,
      features: result.features ?? {},
    };
  }

  private applyWeakOnnxSuppression(signals: AcceptedSignal[], features: Record<string, number>): void {
    const heuristic = signals.find(signal => signal.source === "heuristic" && signal.weight > 0);
    const onnx = signals.find(signal => signal.source === "onnx");
    if (!heuristic || !onnx) return;

    if (
      onnx.remainingMl <= this.config.nearZeroOnnxMl &&
      heuristic.remainingMl >= this.config.weakOnnxHeuristicMl
    ) {
      onnx.weight = 0;
      features._fusionIgnored_onnx_nearZeroEstimate = 1;
      features._fusionSignal_onnx_weight = 0;
    }
  }

  private disagreementPenalty(signals: AcceptedSignal[], features: Record<string, number>): number {
    if (signals.length < 2) return 0;
    const estimates = signals.map(signal => signal.remainingMl);
    const spread = Math.max(...estimates) - Math.min(...estimates);
    if (spread <= this.config.disagreementMl) return 0;

    const heuristic = signals.find(signal => signal.source === "heuristic");
    const onnx = signals.find(signal => signal.source === "onnx");
    if (heuristic && onnx && Math.abs(heuristic.remainingMl - onnx.remainingMl) > this.config.disagreementMl) {
      features._fusionReason_conflictingFullVsEmpty = 1;
    }

    return Math.min(0.35, spread / this.config.maxReasonableRemainingMl);
  }

  private fallback(
    features: Record<string, number>,
    captured: CapturedResult[],
    reason: "noValidSignals" | "zeroTotalWeight",
  ): ScorerResult {
    features._fusionFallback = 1;
    features[`_fusionReason_${reason}`] = 1;
    features._fusionValidSignalCount = features._fusionValidSignalCount ?? 0;

    const best = captured
      .map(item => item.result)
      .filter((result): result is ScorerResult => result !== undefined && isFiniteNumber(result.score))
      .sort((a, b) => b.score - a.score)[0];

    return {
      remainingMl: best && isFiniteNumber(best.remainingMl) && best.remainingMl >= 0 ? round1(best.remainingMl) : 0,
      confidence: Math.min(best && isFiniteNumber(best.confidence) ? clamp01(best.confidence) : 0, this.config.fallbackConfidenceThreshold),
      source: best?.source ?? "fusion-fallback",
      features,
      score: Math.min(best && isFiniteNumber(best.score) ? clamp01(best.score) : 0, this.config.fallbackConfidenceThreshold),
    };
  }
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

function round3(value: number): number {
  return Math.round(value * 1000) / 1000;
}
