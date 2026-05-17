import { describe, expect, it, vi } from "vitest";
import { runPipeline } from "../src/cv/pipeline.js";
import * as loader from "../src/onnx/loader.js";
import * as ort from "onnxruntime-web";

// Mock the ONNX loader to avoid actual model loading/inference in unit tests
vi.mock("../src/onnx/loader.js", () => ({
  isModelLoaded: vi.fn(() => false),
  loadOnnxModel: vi.fn(async () => {}),
  runOnnxInference: vi.fn(async () => ({
    "output": {
      data: new Float32Array([0.85]),
      dims: [1, 1],
      type: "float32"
    } as any
  }))
}));

// Mock preprocess and detectMeniscus to return predictable results
vi.mock("../src/cv/preprocess.js", () => ({
  preprocess: vi.fn(async () => ({ equalized: {}, width: 100, height: 100 })),
  releasePreprocessed: vi.fn()
}));

vi.mock("../src/cv/contour.js", () => ({
  detectMeniscus: vi.fn(async () => ({
    found: true,
    meniscusY: 50,
    meniscusYRatio: 0.5,
    bottleTopY: 10,
    bottleBottomY: 90,
    edgeStrength: 1000,
    contourCount: 5,
    geometry: {}
  }))
}));

describe("ONNX Model Integration in Pipeline", () => {
  it("loads model lazily and runs inference", async () => {
    const isModelLoadedSpy = vi.mocked(loader.isModelLoaded);
    const loadOnnxModelSpy = vi.mocked(loader.loadOnnxModel);
    const runOnnxInferenceSpy = vi.mocked(loader.runOnnxInference);

    // First call: model not loaded
    isModelLoadedSpy.mockReturnValue(false);
    
    const input = { imageData: new ArrayBuffer(0) };
    const result = await runPipeline(input);

    expect(loadOnnxModelSpy).toHaveBeenCalled();
    // Simulate model being loaded for the second part of runPipeline
    isModelLoadedSpy.mockReturnValue(true);
    
    // We need to re-run or adjust mock to simulate the flow within one call
    // Actually, runPipeline checks isModelLoaded twice if we want it to work in one go.
    // In our implementation:
    // 1. Check isModelLoaded() -> false -> call loadOnnxModel()
    // 2. Later, check isModelLoaded() -> if we want it to run inference, it must be true now.
    
    isModelLoadedSpy.mockReturnValueOnce(false).mockReturnValue(true);

    const result2 = await runPipeline(input);
    
    expect(runOnnxInferenceSpy).toHaveBeenCalled();
    expect(result2.diagnostics.onnxScore).toBeCloseTo(0.85, 4);
    expect(result2.diagnostics.onnxLoadStatus).toContain("loaded");
  });

  it("passes the four-feature regression tensor into ONNX", async () => {
    const isModelLoadedSpy = vi.mocked(loader.isModelLoaded);
    isModelLoadedSpy.mockReturnValue(true);

    await runPipeline({ imageData: new ArrayBuffer(0) });

    const tensor = vi.mocked(loader.runOnnxInference).mock.calls.at(-1)?.[0]["input"];
    expect(tensor?.dims).toEqual([1, 4]);
    expect(Array.from(tensor?.data as Float32Array)).toEqual([
      expect.closeTo(0.5),
      expect.closeTo(0.05),
      expect.closeTo(0.5),
      expect.closeTo(1),
    ]);
  });

  it("clamps ONNX output before using it as confidence input", async () => {
    vi.mocked(loader.isModelLoaded).mockReturnValue(true);
    vi.mocked(loader.runOnnxInference).mockResolvedValue({
      "output": {
        data: new Float32Array([-9.35]),
        dims: [1, 1],
        type: "float32"
      } as any
    });

    const result = await runPipeline({ imageData: new ArrayBuffer(0) });

    expect(result.diagnostics.onnxScore).toBe(0);
    expect(result.confidence).toBeGreaterThanOrEqual(0);
  });

  it("integrates ONNX score into confidence calculation", async () => {
    vi.mocked(loader.isModelLoaded).mockReturnValue(true);
    vi.mocked(loader.runOnnxInference).mockResolvedValue({
      "output": {
        data: new Float32Array([0.9]),
        dims: [1, 1],
        type: "float32"
      } as any
    });

    const result = await runPipeline({ imageData: new ArrayBuffer(0) });

    // Heuristic confidence remains independent from ONNX. Fusion uses ONNX as
    // a conservative weighted signal and applies disagreement penalties.
    expect(result.confidence).toBeLessThan(0.4875);
    expect(result.diagnostics.fusion?.features._fusionDisagreementPenalty).toBeGreaterThan(0);
    expect(result.diagnostics.onnxScore).toBeCloseTo(0.9, 4);
  });
});
