import { describe, expect, it } from "vitest";
import { loadOnnxModel, runOnnxInference, isModelLoaded } from "../src/onnx/loader.js";
import * as ort from "onnxruntime-web";

describe("Concurrency Stress Test (Local Node.js)", () => {
  it("handles 10 concurrent requests without exhaustion", async () => {
    // 1. Ensure model is loaded
    if (!isModelLoaded()) {
      await loadOnnxModel("src/onnx/models/regression.onnx");
    }

    // 2. Monitor memory before
    const memBefore = process.memoryUsage().rss / (1024 * 1024);
    console.log(`Memory before concurrency: ${memBefore.toFixed(2)} MB`);

    // 3. Fire 10 concurrent inferences
    console.log("Firing 10 concurrent inferences...");
    const start = Date.now();
    const requests = Array.from({ length: 10 }).map((_, i) =>
      runOnnxInference({
        input: new ort.Tensor(new Float32Array(4).fill(0.5), [1, 4]),
      })
    );

    const results = await Promise.all(requests);
    const duration = Date.now() - start;

    // 4. Monitor memory after
    const memAfter = process.memoryUsage().rss / (1024 * 1024);
    console.log(`Memory after concurrency: ${memAfter.toFixed(2)} MB`);
    console.log(`Finished 10 inferences in ${duration}ms`);

    expect(results.length).toBe(10);
    for (const res of results) {
      expect(res.output).toBeDefined();
      // Verify output consistency (singleton session check)
      const data = res.output.data as Float32Array;
      const firstData = results[0].output.data as Float32Array;
      expect(data[0]).toBeCloseTo(firstData[0], 5);
    }

    // Proves it stays within reasonable bounds in Node.js
    // Note: Node.js overhead is higher than Workers, but we look for massive leaks
    expect(memAfter - memBefore).toBeLessThan(50); // Less than 50MB delta for 10 concurrent runs

    console.log("All 10 inferences completed successfully and memory usage is stable.");
  }, 30000);
});
