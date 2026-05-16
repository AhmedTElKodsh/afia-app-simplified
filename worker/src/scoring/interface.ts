export interface ScorerResult {
  remainingMl: number;
  confidence: number;
  source: "heuristic" | "onnx" | string;
  features: Record<string, number>;
  score: number; // normalized 0-1 quality score
}

export interface Scorer {
  readonly name: string;
  score(imageData: ArrayBuffer): Promise<ScorerResult>;
}
