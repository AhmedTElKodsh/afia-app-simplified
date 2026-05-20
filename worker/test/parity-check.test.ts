import { afterEach, describe, expect, it } from "vitest";
import { Hono } from "hono";
import * as ort from "onnxruntime-web";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import app from "../src/index.js";
import { disposeOnnxModel } from "../src/onnx/loader.js";
import { onnxProbeRoute } from "../src/routes/onnx-probe.js";

describe("ONNX Runtime Inference Parity", () => {
  const diagnosticsApp = new Hono();
  diagnosticsApp.get("/api/onnx-probe", onnxProbeRoute);
  const modelPath = "src/onnx/models/regression.onnx";

  const testCases = [
    { input: [0.5, 0.05, 0.5, 1.0], label: "Standard features" },
    { input: [0.2, 0.10, 0.8, 0.5], label: "Low level, high edge" },
    { input: [0.9, 0.01, 0.2, 0.1], label: "High level, low edge" },
    { input: [0.0, 0.00, 0.0, 0.0], label: "Zeroes" },
    { input: [1.0, 1.00, 1.0, 1.0], label: "Ones" },
  ];

  afterEach(async () => {
    await disposeOnnxModel();
  });

  it("produces identical numerical results between Node.js and the diagnostics probe route", async () => {
    const modelBytes = await readFile(resolve(process.cwd(), modelPath));
    const session = await ort.InferenceSession.create(modelBytes.buffer, {
      executionProviders: ["wasm"],
    });

    try {
      for (const testCase of testCases) {
        const nodeInput = new ort.Tensor(new Float32Array(testCase.input), [1, 4]);
        const nodeResults = await session.run({ input: nodeInput });
        const nodeOutput = nodeResults["output"].data as Float32Array;

        const input = encodeURIComponent(testCase.input.join(","));
        const model = encodeURIComponent(modelPath);
        const resp = await diagnosticsApp.request(`/api/onnx-probe?model=${model}&input=${input}`);
        expect(resp.status).toBe(200);
        const workerData = await resp.json() as any;
        const routeOutput = workerData.output.output[0];

        console.log(`${testCase.label} node=${nodeOutput[0]} route=${routeOutput}`);
        expect(routeOutput).toBeCloseTo(nodeOutput[0], 5);
      }
    } finally {
      await session.release();
    }
  }, 30000);

  it("keeps the deployed Stage 1 worker ONNX probe disabled by default", async () => {
    const res = await app.request("/api/onnx-probe");

    expect(res.status).toBe(501);
    await expect(res.json()).resolves.toMatchObject({
      error: "ONNX diagnostics are disabled in the deployed Stage 1 Worker",
    });
  });
});
