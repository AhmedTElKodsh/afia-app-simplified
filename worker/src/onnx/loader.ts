import * as ort from "onnxruntime-web";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

let session: ort.InferenceSession | null = null;
let modelName: string | null = null;

export async function loadOnnxModel(modelPath: string): Promise<void> {
  // Prefer local filesystem reads in Node/tsx so evals do not hang on fetch() of a relative path.
  const absolutePath = resolve(process.cwd(), modelPath);
  const modelBytes = await readFile(absolutePath);
  session = await ort.InferenceSession.create(modelBytes, {
    executionProviders: ["wasm"],
  });
  modelName = modelPath.split("/").pop() ?? "unknown";
  console.log(`ONNX model loaded: ${modelName}`);
}

export async function runOnnxInference(
  inputData: Record<string, ort.Tensor>
): Promise<Record<string, ort.Tensor>> {
  if (!session) throw new Error("Model not loaded. Call loadOnnxModel first.");
  const feeds: Record<string, ort.Tensor> = {};
  for (const [name, tensor] of Object.entries(inputData)) {
    feeds[name] = tensor;
  }
  const results = await session.run(feeds);
  return results;
}

export function isModelLoaded(): boolean {
  return session !== null;
}
