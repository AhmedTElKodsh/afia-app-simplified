import { describe, expect, it } from "vitest";
import { parseAnalysisResponse, parseEvidenceResponse } from "../src/eval/parse-response.js";

describe("parseAnalysisResponse", () => {
  it("parses valid JSON", () => {
    const r = parseAnalysisResponse(`{"remainingMl":800,"consumedMl":700,"redLineYRatio":0.47,"confidence":0.92}`);
    expect(r.remainingMl).toBe(800);
  });
  it("strips ```json fences", () => {
    const r = parseAnalysisResponse("```json\n{\"remainingMl\":800,\"consumedMl\":700,\"redLineYRatio\":0.47,\"confidence\":0.92}\n```");
    expect(r.remainingMl).toBe(800);
  });
  it("clamps redLineYRatio to 0..1", () => {
    const r = parseAnalysisResponse(`{"remainingMl":800,"consumedMl":700,"redLineYRatio":1.5,"confidence":0.9}`);
    expect(r.redLineYRatio).toBe(1);
  });
  it("clamps ml to 0..1500", () => {
    const r = parseAnalysisResponse(`{"remainingMl":-50,"consumedMl":1700,"redLineYRatio":0.1,"confidence":0.8}`);
    expect(r.remainingMl).toBe(0);
    expect(r.consumedMl).toBe(1500);
  });
  it("throws on missing fields", () => {
    expect(() => parseAnalysisResponse(`{"remainingMl":800}`)).toThrow();
  });
  it("throws on non-JSON", () => {
    expect(() => parseAnalysisResponse("not json")).toThrow();
  });
});

describe("parseEvidenceResponse", () => {
  it("parses evidence fields and derives remaining/consumed ml from oilSurfaceYRatio", () => {
    const r = parseEvidenceResponse(`{
      "readingPossible": true,
      "meniscusVisible": "yes",
      "oilSurfaceYRatio": 0.35,
      "nearestReferenceMl": 1125,
      "qualityFlags": ["mild_glare"],
      "confidence": 0.72
    }`);

    expect(r.remainingMl).toBe(1173);
    expect(r.consumedMl).toBe(327);
    expect(r.fillPercent).toBe(78);
    expect(r.redLineYRatio).toBe(0.35);
    expect(r.qualityFlags).toEqual(["mild_glare"]);
  });

  it("clamps oilSurfaceYRatio and known numeric evidence fields", () => {
    const r = parseEvidenceResponse(`{
      "readingPossible": true,
      "meniscusVisible": "uncertain",
      "oilSurfaceYRatio": 2,
      "nearestReferenceMl": 2000,
      "qualityFlags": [],
      "confidence": 4
    }`);

    expect(r.remainingMl).toBe(0);
    expect(r.consumedMl).toBe(1500);
    expect(r.fillPercent).toBe(0);
    expect(r.redLineYRatio).toBe(1);
    expect(r.nearestReferenceMl).toBe(1500);
    expect(r.confidence).toBe(1);
  });
});
