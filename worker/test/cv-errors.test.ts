import { describe, expect, it } from "vitest";
import {
  contourNotFound,
  implausibleRatio,
  perspectiveFailed,
  regressionFailed,
  llmTimeout,
  internalError,
} from "../src/cv/errors.js";

describe("PipelineError factories", () => {
  it("contourNotFound has correct shape", () => {
    const err = contourNotFound();
    expect(err.stage).toBe("contour");
    expect(err.code).toBe("CONTOUR_NOT_FOUND");
    expect(err.recoverable).toBe(false);
    expect(err.message).toBeTruthy();
  });

  it("implausibleRatio includes the ratio in message", () => {
    const err = implausibleRatio(1.5);
    expect(err.stage).toBe("contour");
    expect(err.code).toBe("IMPLAUSIBLE_RATIO");
    expect(err.message).toContain("1.50");
    expect(err.recoverable).toBe(false);
  });

  it("perspectiveFailed is recoverable", () => {
    const err = perspectiveFailed();
    expect(err.stage).toBe("preprocess");
    expect(err.code).toBe("PERSPECTIVE_FAILED");
    expect(err.recoverable).toBe(true);
  });

  it("regressionFailed includes error message", () => {
    const err = regressionFailed("Model OOM");
    expect(err.stage).toBe("regression");
    expect(err.code).toBe("REGRESSION_FAILED");
    expect(err.message).toContain("Model OOM");
    expect(err.recoverable).toBe(true);
  });

  it("llmTimeout is recoverable", () => {
    const err = llmTimeout();
    expect(err.stage).toBe("llm_validation");
    expect(err.code).toBe("LLM_TIMEOUT");
    expect(err.recoverable).toBe(true);
  });

  it("internalError includes message", () => {
    const err = internalError("Something broke");
    expect(err.stage).toBe("pipeline");
    expect(err.code).toBe("INTERNAL_ERROR");
    expect(err.message).toContain("Something broke");
    expect(err.recoverable).toBe(false);
  });

  it("all errors have stage, code, message, recoverable", () => {
    const factories = [contourNotFound, () => implausibleRatio(0), perspectiveFailed, () => regressionFailed("x"), llmTimeout, () => internalError("x")];
    for (const factory of factories) {
      const err = factory();
      expect(err).toHaveProperty("stage");
      expect(err).toHaveProperty("code");
      expect(err).toHaveProperty("message");
      expect(err).toHaveProperty("recoverable");
    }
  });
});
