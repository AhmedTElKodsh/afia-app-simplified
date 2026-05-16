export interface PipelineError {
  stage: string;
  code: string;
  message: string;
  recoverable: boolean;
}

export function contourNotFound(): PipelineError {
  return {
    stage: "contour",
    code: "CONTOUR_NOT_FOUND",
    message: "Contour detection could not identify bottle body in image",
    recoverable: false,
  };
}

export function implausibleRatio(ratio: number): PipelineError {
  return {
    stage: "contour",
    code: "IMPLAUSIBLE_RATIO",
    message: `Detected fill ratio ${ratio.toFixed(2)} is outside expected range (0-1)`,
    recoverable: false,
  };
}

export function perspectiveFailed(): PipelineError {
  return {
    stage: "preprocess",
    code: "PERSPECTIVE_FAILED",
    message: "Perspective correction could not align bottle",
    recoverable: true,
  };
}

export function regressionFailed(error: string): PipelineError {
  return {
    stage: "regression",
    code: "REGRESSION_FAILED",
    message: `Regression model inference failed: ${error}`,
    recoverable: true,
  };
}

export function llmTimeout(): PipelineError {
  return {
    stage: "llm_validation",
    code: "LLM_TIMEOUT",
    message: "LLM validation exceeded timeout, proceeding without validation",
    recoverable: true,
  };
}

export function internalError(error: string): PipelineError {
  return {
    stage: "pipeline",
    code: "INTERNAL_ERROR",
    message: `Pipeline internal error: ${error}`,
    recoverable: false,
  };
}
