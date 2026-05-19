#!/usr/bin/env tsx
import { readFileSync, statSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import * as ort from "onnxruntime-web";

// Models available at runtime. Regression is generated in Task 3.
const ALL_MODELS = ["constant.onnx", "identity.onnx", "regression.onnx"];
const WARMUP_RUNS = 50;
const MEASURE_RUNS = 5;

interface Thresholds {
  maxBinaryMb: number;
  maxP95Ms: number;
  maxRssMb: number;
  maxColdStartMs: number;
}

const THRESHOLDS: Thresholds = {
  maxBinaryMb: 15,
  maxP95Ms: 500,
  maxRssMb: 80,
  maxColdStartMs: 2000,
};

async function benchmarkModel(modelFile: string): Promise<{
  modelName: string;
  binarySizeMb: number;
  coldStartMs: number;
  warmLatenciesMs: number[];
  p95Ms: number;
  peakRssMb: number;
  pass: boolean;
  failures: string[];
}> {
  const failures: string[] = [];
  const modelPath = resolve("src/onnx/models", modelFile);

  // 1. Check binary size
  const binSize = statSync(modelPath).size;
  const binSizeMb = binSize / (1024 * 1024);
  if (binSizeMb > THRESHOLDS.maxBinaryMb) {
    failures.push(`Binary ${binSizeMb.toFixed(1)}MB > ${THRESHOLDS.maxBinaryMb}MB threshold (D-18)`);
    return {
      modelName: modelFile, binarySizeMb: binSizeMb, coldStartMs: 0,
      warmLatenciesMs: [], p95Ms: 0, peakRssMb: 0,
      pass: false, failures,
    };
  }

  // 2. Cold-start load
  const modelBytes = readFileSync(modelPath);
  const t0 = performance.now();
  // Use default execution provider (cpu in Node.js, wasm in Workers).
  // In Node.js, onnxruntime-web's native backend uses the CPU provider automatically.
  // Pass Buffer directly (as Uint8Array), not modelBytes.buffer (ArrayBuffer may have oversized backing store)
  const session = await ort.InferenceSession.create(modelBytes);
  const coldStartMs = performance.now() - t0;

  // Determine feeds based on model input names
  const feeds: Record<string, ort.Tensor> = {};
  const inputNames = session.inputNames;
  if (inputNames.length > 0) {
    const inputTensor = new ort.Tensor(new Float32Array(4).fill(0.5), [1, 4]);
    for (const name of inputNames) {
      feeds[name] = inputTensor;
    }
  }

  // 3. Warm-up runs (50)
  const latencies: number[] = [];
  for (let i = 0; i < WARMUP_RUNS; i++) {
    const t1 = performance.now();
    await session.run(feeds);
    latencies.push(performance.now() - t1);
  }

  // 4. Measured runs (5 more)
  for (let i = 0; i < MEASURE_RUNS; i++) {
    const t1 = performance.now();
    await session.run(feeds);
    latencies.push(performance.now() - t1);
  }

  const sorted = [...latencies].sort((a, b) => a - b);
  const p95 = sorted[Math.floor(sorted.length * 0.95)];

  // 5. Approximate RSS
  const memBefore = process.memoryUsage().rss;
  const peakRssMb = memBefore / (1024 * 1024);

  if (p95 > THRESHOLDS.maxP95Ms) {
    failures.push(`p95 ${p95.toFixed(0)}ms > ${THRESHOLDS.maxP95Ms}ms threshold (D-18)`);
  }
  if (coldStartMs > THRESHOLDS.maxColdStartMs) {
    failures.push(`Cold-start ${coldStartMs.toFixed(0)}ms > ${THRESHOLDS.maxColdStartMs}ms threshold (D-18)`);
  }
  // RSS check is approximate in Node.js — Workers RSS may differ
  // But flag if very high
  if (peakRssMb > THRESHOLDS.maxRssMb) {
    failures.push(`RSS ${peakRssMb.toFixed(0)}MB > ${THRESHOLDS.maxRssMb}MB threshold (D-18, approximate)`);
  }

  return {
    modelName: modelFile,
    binarySizeMb: binSizeMb,
    coldStartMs,
    warmLatenciesMs: sorted,
    p95Ms: p95,
    peakRssMb,
    pass: failures.length === 0,
    failures,
  };
}

async function main() {
  console.log("=== ONNX Benchmark vs D-18 Thresholds ===\n");
  const results = [];

  const MODELS = ALL_MODELS.filter(m => existsSync(resolve("src/onnx/models", m)));
  console.log(`Models found: ${MODELS.join(", ")}`);

  for (const model of MODELS) {
    console.log(`Benchmarking: ${model}...`);
    const r = await benchmarkModel(model);
    results.push(r);
    console.log(`  Binary: ${r.binarySizeMb.toFixed(1)} MB`);
    console.log(`  Cold-start: ${r.coldStartMs.toFixed(0)} ms`);
    console.log(`  p95 latency: ${r.p95Ms.toFixed(0)} ms`);
    console.log(`  Peak RSS: ${r.peakRssMb.toFixed(0)} MB`);
    console.log(`  PASS: ${r.pass ? "✅" : "❌"}`);
    if (r.failures.length > 0) {
      r.failures.forEach(f => console.log(`  ⚠ ${f}`));
    }
    console.log();
  }

  const writeResults = (await import("node:fs/promises")).writeFile;
  const outPath = resolve(dirname(fileURLToPath(import.meta.url)), "../../../runs/onnx-benchmark", `benchmark-${Date.now()}.json`);
  await writeResults(outPath, JSON.stringify(results, null, 2));
  console.log(`Results written: ${outPath}`);
}

main().catch(console.error);
