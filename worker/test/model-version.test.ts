import { describe, expect, it } from "vitest";
import { createModelVersion, validateModelVersion } from "../src/eval/model-version";
import type { ModelVersion } from "../src/eval/model-version";

describe("ModelVersion", () => {
  const valid: ModelVersion = {
    onnxHash: "a".repeat(64),
    extractorVersion: "1.0.0",
    promptHash: "b".repeat(64),
    evalSummary: {
      date: "2026-05-15T00:00:00Z",
      testSet: "holdout",
      exactAccuracy: 0.85,
      closeAccuracy: 0.95,
      mae: 42.0,
      rmse: 65.0,
      sampleCount: 40,
    },
  };

  it("createModelVersion builds a valid ModelVersion", () => {
    const v = createModelVersion({
      onnxHash: "a".repeat(64),
      extractorVersion: "1.0.0",
      promptHash: "b".repeat(64),
      evalSummary: valid.evalSummary,
    });
    expect(v.onnxHash).toBe("a".repeat(64));
    expect(v.promptHash).toBe("b".repeat(64));
    expect(v.evalSummary.sampleCount).toBe(40);
  });

  it("createModelVersion sets promptHash to null when omitted", () => {
    const v = createModelVersion({
      onnxHash: "a".repeat(64),
      extractorVersion: "1.0.0",
      evalSummary: valid.evalSummary,
    });
    expect(v.promptHash).toBeNull();
  });

  it("validateModelVersion passes on valid input", () => {
    expect(validateModelVersion(valid)).toEqual([]);
  });

  it("validateModelVersion rejects invalid onnxHash", () => {
    const errors = validateModelVersion({ ...valid, onnxHash: "not-a-hash" });
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]).toContain("onnxHash");
  });

  it("validateModelVersion rejects empty extractorVersion", () => {
    const errors = validateModelVersion({ ...valid, extractorVersion: "" });
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]).toContain("extractorVersion");
  });

  it("validateModelVersion rejects out-of-range accuracy", () => {
    const badEval = { ...valid, evalSummary: { ...valid.evalSummary, exactAccuracy: 1.5 } };
    const errors = validateModelVersion(badEval);
    expect(errors.some((e) => e.includes("exactAccuracy"))).toBe(true);
  });

  it("validateModelVersion rejects negative mae", () => {
    const badEval = { ...valid, evalSummary: { ...valid.evalSummary, mae: -1 } };
    const errors = validateModelVersion(badEval);
    expect(errors.some((e) => e.includes("mae"))).toBe(true);
  });

  it("validateModelVersion rejects zero sampleCount", () => {
    const badEval = { ...valid, evalSummary: { ...valid.evalSummary, sampleCount: 0 } };
    const errors = validateModelVersion(badEval);
    expect(errors.some((e) => e.includes("sampleCount"))).toBe(true);
  });

  it("validateModelVersion rejects invalid date format", () => {
    const badEval = { ...valid, evalSummary: { ...valid.evalSummary, date: "not-a-date" } };
    const errors = validateModelVersion(badEval);
    expect(errors.some((e) => e.includes("date"))).toBe(true);
  });
});
