// Model version tracking — every evaluation run records these fields
// so accuracy regressions are traceable to specific model artifacts.

export interface EvalSummary {
  date: string; // ISO 8601
  testSet: string; // manifest path or name
  exactAccuracy: number; // fraction 0-1
  closeAccuracy: number; // fraction 0-1
  mae: number; // mean absolute error in ml
  rmse: number; // root mean squared error in ml
  sampleCount: number;
}

export interface ModelVersion {
  onnxHash: string; // SHA-256 of the ONNX model binary
  extractorVersion: string; // semver of feature extraction code
  promptHash: string | null; // SHA-256 of CV prompt (null for ONNX-only pipeline)
  evalSummary: EvalSummary; // most recent evaluation results
}

export function createModelVersion(params: {
  onnxHash: string;
  extractorVersion: string;
  promptHash?: string;
  evalSummary: EvalSummary;
}): ModelVersion {
  return {
    onnxHash: params.onnxHash,
    extractorVersion: params.extractorVersion,
    promptHash: params.promptHash ?? null,
    evalSummary: params.evalSummary,
  };
}

export function validateModelVersion(v: ModelVersion): string[] {
  const errors: string[] = [];
  if (!/^[a-f0-9]{64}$/i.test(v.onnxHash))
    errors.push("onnxHash must be a 64-char hex SHA-256");
  if (!v.extractorVersion)
    errors.push("extractorVersion is required");
  if (v.evalSummary.exactAccuracy < 0 || v.evalSummary.exactAccuracy > 1)
    errors.push("exactAccuracy must be between 0 and 1");
  if (v.evalSummary.closeAccuracy < 0 || v.evalSummary.closeAccuracy > 1)
    errors.push("closeAccuracy must be between 0 and 1");
  if (v.evalSummary.mae < 0)
    errors.push("mae must be non-negative");
  if (v.evalSummary.rmse < 0)
    errors.push("rmse must be non-negative");
  if (v.evalSummary.sampleCount <= 0)
    errors.push("sampleCount must be positive");
  if (!/^\d{4}-\d{2}-\d{2}/.test(v.evalSummary.date))
    errors.push("date must be ISO 8601");
  return errors;
}
