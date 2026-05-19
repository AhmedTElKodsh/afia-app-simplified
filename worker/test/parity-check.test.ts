import { describe, expect, it } from "vitest";
import { unstable_dev } from "wrangler";
import type { Unstable_DevWorker } from "wrangler";
import * as ort from "onnxruntime-web";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

describe("ONNX Runtime Inference Parity", () => {
  let worker: Unstable_DevWorker;

  // We'll use these fixed feature vectors for parity checking
  const testCases = [
    { input: [0.5, 0.05, 0.5, 1.0], label: "Standard features" },
    { input: [0.2, 0.10, 0.8, 0.5], label: "Low level, high edge" },
    { input: [0.9, 0.01, 0.2, 0.1], label: "High level, low edge" },
    { input: [0.0, 0.00, 0.0, 0.0], label: "Zeroes" },
    { input: [1.0, 1.00, 1.0, 1.0], label: "Ones" },
  ];

  it("produces identical numerical results between Node.js and Workers runtime", async () => {
    // 1. Start Miniflare worker via wrangler unstable_dev
    worker = await (unstable_dev as any)("src/index.ts", {
      // experimental: { disableFetchMock: true },
    });

    try {
      // 2. Load the same model in Node.js context
      const modelPath = resolve(process.cwd(), "src/onnx/models/regression.onnx");
      const modelBytes = await readFile(modelPath);
      const session = await ort.InferenceSession.create(modelBytes.buffer, {
        executionProviders: ["wasm"],
      });

      for (const testCase of testCases) {
        // 3. Run inference in Node.js
        const nodeInput = new ort.Tensor(new Float32Array(testCase.input), [1, 4]);
        const nodeResults = await session.run({ input: nodeInput });
        const nodeOutput = nodeResults["output"].data as Float32Array;

        // 4. Run the same vector in Worker via the onnx-probe endpoint.
        const input = encodeURIComponent(testCase.input.join(","));
        const resp = await worker.fetch(`/api/onnx-probe?model=regression&input=${input}`);
        expect(resp.status).toBe(200);
        const workerData = await resp.json() as any;
        const workerOutput = workerData.output.output[0]; // onnx-probe returns { output: { output: [val] } }

        console.log(`${testCase.label} node=${nodeOutput[0]} worker=${workerOutput}`);

        expect(workerOutput).toBeCloseTo(nodeOutput[0], 5);
      }

      await session.release();
    } finally {
      await worker.stop();
    }
  }, 30000); // 30s timeout for WASM load + inference
});
