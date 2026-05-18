import { describe, expect, it } from "vitest";
import * as ort from "onnxruntime-web";
import { resolveOnnxModelPath } from "../src/onnx/loader.js";
import type { InferenceSession } from "onnxruntime-web";

async function withSession<T>(session: InferenceSession, fn: (session: InferenceSession) => Promise<T>): Promise<T> {
  try {
    return await fn(session);
  } finally {
    await session.release();
  }
}

// Note: These tests run locally (tsx/vitest Node.js environment).
// Workers runtime test is Task 2 (endpoint deployment).

describe("ONNX Runtime Loading", () => {
  it("ort is importable and has InferenceSession", () => {
    expect(typeof ort.InferenceSession).toBe("function");
  });

  it("resolves model paths when launched from repository root", async () => {
    const path = await resolveOnnxModelPath("./src/onnx/models/regression.onnx");
    expect(path.replaceAll("\\", "/")).toMatch(/worker\/src\/onnx\/models\/regression\.onnx$/);
  });

  it("can load constant model from disk", async () => {
    const fs = await import("node:fs/promises");
    const path = await import("node:path");
    const modelPath = path.resolve("src/onnx/models/constant.onnx");
    const modelBytes = await fs.readFile(modelPath);
    await withSession(await ort.InferenceSession.create(modelBytes.buffer), async (session) => {
      expect(session).toBeDefined();
      expect(session.inputNames).toBeDefined();
    });
  });

  it("constant model returns expected output", async () => {
    const fs = await import("node:fs/promises");
    const path = await import("node:path");
    const modelPath = path.resolve("src/onnx/models/constant.onnx");
    const modelBytes = await fs.readFile(modelPath);
    await withSession(await ort.InferenceSession.create(modelBytes.buffer), async (session) => {
      // Constant model has no inputs, pass empty feeds object
      const results = await session.run({});
      const output = results["output"];
      expect(output).toBeDefined();
      // For a constant model with shape [1], the output should be a tensor with value ~0.5
      const data = output.data as Float32Array;
      expect(data[0]).toBeCloseTo(0.5, 1);
    });
  });

  it("identity model passes input through unchanged", async () => {
    const fs = await import("node:fs/promises");
    const path = await import("node:path");
    const modelPath = path.resolve("src/onnx/models/identity.onnx");
    const modelBytes = await fs.readFile(modelPath);
    await withSession(await ort.InferenceSession.create(modelBytes.buffer), async (session) => {
      const input = new ort.Tensor(new Float32Array([1, 2, 3, 4]), [1, 4]);
      const results = await session.run({ input });
      const output = results["output"];
      expect(output).toBeDefined();
      const data = output.data as Float32Array;
      expect(Array.from(data)).toEqual([1, 2, 3, 4]);
    });
  });
});
