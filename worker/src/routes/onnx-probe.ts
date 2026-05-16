import type { Context } from "hono";
import type { Env } from "../env.js";
import { loadOnnxModel, runOnnxInference, isModelLoaded } from "../onnx/loader.js";
import * as ort from "onnxruntime-web";

export async function onnxProbeRoute(c: Context<{ Bindings: Env }>) {
  const modelName = c.req.query("model") ?? "constant";

  try {
    // Load model if not loaded
    if (!isModelLoaded()) {
      const t0 = Date.now();
      // In Workers, model must be fetched from assets or KV.
      // For the probe, fetch from the deployed script's relative path.
      await loadOnnxModel(modelName);
      const loadTime = Date.now() - t0;

      // Run a single inference
      const t1 = Date.now();
      const results = await runOnnxInference({
        input: new ort.Tensor(new Float32Array(4).fill(0.5), [1, 4]),
      });
      const inferenceTime = Date.now() - t1;

      return c.json({
        model: modelName,
        coldStart: true,
        loadTimeMs: loadTime,
        inferenceTimeMs: inferenceTime,
        output: Object.fromEntries(
          Object.entries(results).map(([k, v]) => [k, Array.from(v.data as Float32Array)])
        ),
      });
    }

    // Warm inference
    const t1 = Date.now();
    const results = await runOnnxInference({
      input: new ort.Tensor(new Float32Array(4).fill(0.5), [1, 4]),
    });
    const inferenceTime = Date.now() - t1;

    return c.json({
      model: modelName,
      coldStart: false,
      inferenceTimeMs: inferenceTime,
      output: Object.fromEntries(
        Object.entries(results).map(([k, v]) => [k, Array.from(v.data as Float32Array)])
      ),
    });
  } catch (e) {
    return c.json({ error: (e as Error).message }, 500);
  }
}
