import { describe, expectTypeOf, it } from "vitest";
import type { EvalAnalysisResult, RunRecord } from "./types";

describe("eval-only types", () => {
  it("keeps evaluation analysis results distinct from product API results", () => {
    expectTypeOf<RunRecord>().toHaveProperty("parsedMl").toEqualTypeOf<number | null>();
    expectTypeOf<EvalAnalysisResult>().toHaveProperty("promptHash").toEqualTypeOf<string>();
  });
});
