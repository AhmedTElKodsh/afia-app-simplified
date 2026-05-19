import { describe, expect, it, vi, beforeEach } from "vitest";
import { runPipeline } from "../src/cv/pipeline.js";
import * as loader from "../src/onnx/loader.js";

vi.mock("../src/onnx/loader.js", () => ({
  isModelLoaded: vi.fn(() => false),
  loadOnnxModel: vi.fn(async () => {}),
  runOnnxInference: vi.fn(async () => ({
    output: { data: new Float32Array([0.85]), dims: [1, 1], type: "float32" } as any,
  })),
}));

vi.mock("../src/cv/preprocess.js", () => ({
  preprocess: vi.fn(async () => ({ equalized: {}, width: 100, height: 100 })),
  releasePreprocessed: vi.fn(),
}));

vi.mock("../src/cv/contour.js", () => ({
  detectMeniscus: vi.fn(async () => ({
    found: true,
    meniscusY: 50,
    meniscusYRatio: 0.5,
    bottleTopY: 10,
    bottleBottomY: 90,
    edgeStrength: 1800,
    contourCount: 5,
    geometry: {},
  })),
}));

describe("CV pipeline fusion", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(loader.isModelLoaded).mockReturnValue(false);
    vi.mocked(loader.runOnnxInference).mockResolvedValue({
      output: { data: new Float32Array([0.85]), dims: [1, 1], type: "float32" } as any,
    });
  });

  it("does not let a zero ONNX score crush a usable heuristic estimate", async () => {
    vi.mocked(loader.isModelLoaded).mockReturnValue(true);
    vi.mocked(loader.runOnnxInference).mockResolvedValue({
      output: { data: new Float32Array([0]), dims: [1, 1], type: "float32" } as any,
    });

    const result = await runPipeline({ imageData: new ArrayBuffer(0), bottleSizeMl: 1500 });

    expect(result.success).toBe(true);
    expect(result.fillRatio).toBeCloseTo(0.5, 2);
    expect(result.confidence).toBeLessThan(0.7);
    expect(result.tier).toBe("medium");
    expect(result.diagnostics.stages).toContain("fusion");
    expect(result.diagnostics.fusion?.features._fusionIgnored_onnx_nearZeroEstimate).toBe(1);
    expect(result.diagnostics.fusion?.features._fusionSignal_onnx_weight).toBe(0);
    expect(result.diagnostics.fusion?.features._fusionReason_singleValidSignal).toBe(1);
  });

  it("records a disagreement penalty for contradictory ONNX estimates", async () => {
    vi.mocked(loader.isModelLoaded).mockReturnValue(true);
    vi.mocked(loader.runOnnxInference).mockResolvedValue({
      output: { data: new Float32Array([1]), dims: [1, 1], type: "float32" } as any,
    });

    const result = await runPipeline({ imageData: new ArrayBuffer(0), bottleSizeMl: 1500 });

    expect(result.diagnostics.fusion?.features._fusionDisagreementPenalty).toBeGreaterThan(0);
    expect(result.diagnostics.fusion?.features._fusionReason_conflictingFullVsEmpty).toBe(1);
  });

  it("ignores invalid optional LLM numeric hints", async () => {
    const result = await runPipeline({
      imageData: new ArrayBuffer(0),
      bottleSizeMl: 1500,
      llmRemainingMl: Number.NaN,
      llmConfidence: 2,
      llmScore: 0.9,
    });

    expect(result.success).toBe(true);
    expect(result.diagnostics.fusion?.features._fusionIgnored_llm_invalidEstimate).toBe(1);
    expect(result.diagnostics.fusion?.features._fusionSignal_llm_weight).toBe(0);
  });

  it("continues with heuristic fusion diagnostics when ONNX loading fails", async () => {
    vi.mocked(loader.isModelLoaded).mockReturnValue(false);
    vi.mocked(loader.loadOnnxModel).mockRejectedValue(new Error("missing model"));

    const result = await runPipeline({ imageData: new ArrayBuffer(0), bottleSizeMl: 1500 });

    expect(result.success).toBe(true);
    expect(result.diagnostics.onnxLoadStatus).toContain("fail:");
    expect(result.diagnostics.fusion?.features._fusionValidSignalCount).toBe(1);
    expect(result.diagnostics.fusion?.features._fusionSignal_heuristic_weight).toBeGreaterThan(0);
  });
});
