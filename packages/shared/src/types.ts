export interface AnalysisResult {
  remainingMl: number;
  consumedMl: number;
  redLineYRatio: number;
  confidence: number;
  rawModelText: string;
  promptHash: string;
  fewshotHash: string;
  modelId: string;
}

export interface RunRecord {
  runId: string;
  runStartedTs: string;
  promptHash: string;
  fewshotHash: string;
  modelId: string;
  modelVersion: string;
  imageId: string;
  imagePath: string;
  stratum: string;
  groundTruthMl: number;
  rawOutput: string;
  parsedMl: number | null;
  parsedConfidence: number | null;
  absErrorMl: number | null;
  exactBucketPass: boolean;
  closeBucketPass: boolean;
  comparatorName: string;
  comparatorVersion: string;
  holdoutTouches: number;
}
