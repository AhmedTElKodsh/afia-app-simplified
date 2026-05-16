import * as ort from "onnxruntime-web";
import { access, readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

let session: ort.InferenceSession | null = null;
let modelName: string | null = null;

const __dirname = dirname(fileURLToPath(import.meta.url));
const workerRoot = resolve(__dirname, "../..");

async function firstExistingPath(paths: string[]): Promise<string> {
  for (const path of paths) {
    try {
      await access(path);
      return path;
    } catch {
      // Try next candidate.
    }
  }

  return paths[0];
}

export async function resolveOnnxModelPath(modelPath: string): Promise<string> {
  // Evals may run from the repository root while tests and worker scripts often run
  // from ./worker. Support both cwd layouts instead of hard-coding one launch dir.
  return firstExistingPath([
    resolve(process.cwd(), modelPath),
    resolve(process.cwd(), "worker", modelPath),
    resolve(workerRoot, modelPath.replace(/^\.\/src\//, "src/")),
  ]);
}

export async function loadOnnxModel(modelPath: string): Promise<void> {
  // Prefer local filesystem reads in Node/tsx so evals do not hang on fetch() of a relative path.
  const absolutePath = await resolveOnnxModelPath(modelPath);
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
