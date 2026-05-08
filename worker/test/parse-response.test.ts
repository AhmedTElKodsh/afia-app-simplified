import { describe, expect, it } from "vitest";
import { parseAnalysisResponse } from "../src/eval/parse-response.js";

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
