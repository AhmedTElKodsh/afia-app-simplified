export type ScorerSource = "heuristic" | "onnx" | "llm" | string;

export interface ScorerResult {
  remainingMl: number;
  confidence: number;
  source: ScorerSource;
  features: Record<string, number>;
  score: number; // normalized 0-1 quality score
}

export interface Scorer {
  readonly name: ScorerSource;
  score(imageData: ArrayBuffer): Promise<ScorerResult>;
}
