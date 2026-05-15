import { describe, expect, it } from "vitest";
import * as ort from "onnxruntime-web";

// Note: These tests run locally (tsx/vitest Node.js environment).
// Workers runtime test is Task 2 (endpoint deployment).

describe("ONNX Runtime Loading", () => {
  it("ort is importable and has InferenceSession", () => {
    expect(typeof ort.InferenceSession).toBe("function");
  });

  it("can load constant model from disk", async () => {
    const fs = await import("node:fs/promises");
    const path = await import("node:path");
    const modelPath = path.resolve("src/onnx/models/constant.onnx");
    const modelBytes = await fs.readFile(modelPath);
    const session = await ort.InferenceSession.create(modelBytes.buffer);
    expect(session).toBeDefined();
    expect(session.inputNames).toBeDefined();
  });

  it("constant model returns expected output", async () => {
    const fs = await import("node:fs/promises");
    const path = await import("node:path");
    const modelPath = path.resolve("src/onnx/models/constant.onnx");
    const modelBytes = await fs.readFile(modelPath);
    const session = await ort.InferenceSession.create(modelBytes.buffer);
    // Constant model has no inputs, pass empty feeds object
    const results = await session.run({});
    const output = results["output"];
    expect(output).toBeDefined();
    // For a constant model with shape [1], the output should be a tensor with value ~0.5
    const data = output.data as Float32Array;
    expect(data[0]).toBeCloseTo(0.5, 1);
  });

  it("identity model passes input through unchanged", async () => {
    const fs = await import("node:fs/promises");
    const path = await import("node:path");
    const modelPath = path.resolve("src/onnx/models/identity.onnx");
    const modelBytes = await fs.readFile(modelPath);
    const session = await ort.InferenceSession.create(modelBytes.buffer);
    const input = new ort.Tensor(new Float32Array([1, 2, 3, 4]), [1, 4]);
    const results = await session.run({ input });
    const output = results["output"];
    expect(output).toBeDefined();
    const data = output.data as Float32Array;
    expect(Array.from(data)).toEqual([1, 2, 3, 4]);
  });
});
