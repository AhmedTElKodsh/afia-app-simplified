#!/usr/bin/env tsx
// RSS budget gate for ONNX runtime in Workers environment
// Measures memory usage before and after ONNX model load + inference
// Fails if peak RSS exceeds threshold

import { readFileSync, statSync } from "node:fs";
import { resolve, dirname } from "node:path";
import * as ort from "onnxruntime-web";

const THRESHOLD_MB = 100; // 80% of 128MB Workers isolate limit

async function measureRSS(modelPath: string): Promise<{ loadRssMb: number; peakRssMb: number; binarySizeMb: number }> {
  const binarySize = statSync(modelPath).size;
  const binarySizeMb = binarySize / (1024 * 1024);

  const memBefore = process.memoryUsage().rss;
  const modelBytes = readFileSync(modelPath);
  const session = await ort.InferenceSession.create(modelBytes, {
    executionProviders: ["wasm"],
  });
  const memAfterLoad = process.memoryUsage().rss;

  const inputTensor = new ort.Tensor(new Float32Array(4).fill(0.5), [1, 4]);
  await session.run({ input: inputTensor });
  const memAfterInference = process.memoryUsage().rss;

  return {
    binarySizeMb: Math.round(binarySizeMb * 100) / 100,
    loadRssMb: Math.round((memAfterLoad - memBefore) / (1024 * 1024) * 100) / 100,
    peakRssMb: Math.round(memAfterInference / (1024 * 1024) * 100) / 100,
  };
}

async function main() {
  const models = ["constant.onnx", "identity.onnx", "regression.onnx"];
  const modelDir = "src/onnx/models";

  console.log(`=== ONNX RSS Budget Gate ===`);
  console.log(`Threshold: ${THRESHOLD_MB}MB (80% of Workers 128MB isolate)\n`);

  let allPass = true;
  for (const model of models) {
    const modelPath = resolve(modelDir, model);
    try {
      const result = await measureRSS(modelPath);
      const pass = result.peakRssMb <= THRESHOLD_MB;
      console.log(`${model}:`);
      console.log(`  Binary: ${result.binarySizeMb}MB`);
      console.log(`  RSS delta (load): ${result.loadRssMb}MB`);
      console.log(`  Peak RSS: ${result.peakRssMb}MB`);
      console.log(`  Threshold: ${THRESHOLD_MB}MB → ${pass ? "✅ PASS" : "❌ FAIL"}`);
      if (!pass) allPass = false;
    } catch (e) {
      console.error(`${model}: ❌ ERROR — ${(e as Error).message}`);
      allPass = false;
    }
    console.log();
  }

  if (!allPass) {
    console.error(`❌ RSS GATE FAILED: One or more models exceed ${THRESHOLD_MB}MB threshold`);
    console.error(`   Note: Node.js RSS includes V8 heap and runtime overhead not present in Workers isolate.`);
    console.error(`   Run in miniflare or Workers preview for accurate Workers RSS measurement.`);
    process.exit(1);
  }
  console.log(`✅ RSS GATE PASSED: All models within ${THRESHOLD_MB}MB threshold`);
}

main().catch(e => { console.error(e); process.exit(1); });
