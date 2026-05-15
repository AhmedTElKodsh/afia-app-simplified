import { describe, it, expect } from "vitest";
import { isErrorResult, getSupportEmail, ERROR_CODES } from "../../errors";

describe("isErrorResult", () => {
  it("returns true for error state with tier=error", () => {
    const result = {
      errors: [{ code: ERROR_CODES.ANALYSIS_FAILED, description: "Failed" }],
      tier: "error" as const,
      confidence: 0,
      remainingMl: null,
    };
    expect(isErrorResult(result)).toBe(true);
  });

  it("returns false for normal analysis result", () => {
    const result = { remainingMl: 500, redLineYRatio: 0.5 };
    expect(isErrorResult(result)).toBe(false);
  });

  it("returns false for null", () => {
    expect(isErrorResult(null)).toBe(false);
  });

  it("returns false for undefined", () => {
    expect(isErrorResult(undefined)).toBe(false);
  });

  it("returns false for primitive values", () => {
    expect(isErrorResult("string")).toBe(false);
    expect(isErrorResult(42)).toBe(false);
    expect(isErrorResult(true)).toBe(false);
  });

  it("returns false for object without tier field", () => {
    expect(isErrorResult({ foo: "bar" })).toBe(false);
  });

  it("returns false for object with tier=degraded", () => {
    const result = {
      errors: [],
      tier: "degraded" as const,
      confidence: 0.5,
      remainingMl: 500,
    };
    // degraded is not "error", so isErrorResult returns false
    expect(isErrorResult(result)).toBe(false);
  });
});

describe("getSupportEmail", () => {
  it("returns a non-empty string (default fallback or configured value)", () => {
    const email = getSupportEmail();
    expect(email).toBeTruthy();
    expect(email).toContain("@");
    expect(email).toContain(".");
  });
});

describe("Error state JSON round-trip", () => {
  it("serializes and deserializes error state without data loss", () => {
    const errorState = {
      errors: [
        { code: ERROR_CODES.ANALYSIS_FAILED, description: "Test error" },
      ],
      tier: "error" as const,
      confidence: 0,
      remainingMl: null,
    };

    const serialized = JSON.stringify(errorState);
    const parsed = JSON.parse(serialized);

    // Verify error result detection
    expect(isErrorResult(parsed)).toBe(true);

    // Verify data integrity
    expect(parsed.errors[0].code).toBe(ERROR_CODES.ANALYSIS_FAILED);
    expect(parsed.errors[0].description).toBe("Test error");
    expect(parsed.tier).toBe("error");
    expect(parsed.confidence).toBe(0);
    expect(parsed.remainingMl).toBeNull();
  });

  it("does not confuse normal result with error state", () => {
    const normalResult = {
      remainingMl: 770,
      redLineYRatio: 0.45,
    };

    const serialized = JSON.stringify(normalResult);
    const parsed = JSON.parse(serialized);
    expect(isErrorResult(parsed)).toBe(false);
  });
});
