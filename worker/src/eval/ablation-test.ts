#!/usr/bin/env tsx
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { extname, join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { runPipeline, ratioToCategory } from "../cv/pipeline.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../../..");

// Select 5 images at different fill levels — one from each category
const ablationFixtures = [
  { path: "oil-bottle-frames/empty/empty_t0086.57s_f0173.jpg", ml: 0, cat: "Empty" },
  { path: "oil-bottle-frames/275ml/275ml_t0026.00s_f0052.jpg", ml: 275, cat: "Quarter" },
  { path: "oil-bottle-frames/660ml/660ml_t0006.50s_f0013.jpg", ml: 660, cat: "Half" },
  { path: "oil-bottle-frames/990ml/990ml_t0041.06s_f0082.jpg", ml: 990, cat: "Three Quarter" },
  { path: "oil-bottle-frames/1485ml/1485ml_t0116.75s_f0233.jpg", ml: 1485, cat: "Full" },
];

const outDir = resolve(repoRoot, "runs/ablation");
await mkdir(outDir, { recursive: true });

const results: Array<{
  file: string; groundTruth: { ml: number; cat: string };
  predicted: { ml: number | null; cat: string | null };
  confidence: number; tier: string; contourFound: boolean;
  edgeStrength: number; latencyMs: number; stages: string[];
}> = [];

console.log("=== CV Pipeline Ablation Test ===\n");

for (const fx of ablationFixtures) {
  const t0 = Date.now();
  const imgPath = resolve(repoRoot, fx.path);
  const buf = await readFile(imgPath);
  const base64 = buf.toString("base64");
  const ext = extname(imgPath).toLowerCase();
  const mime = ext === ".png" ? "image/png" : ext === ".webp" ? "image/webp" : "image/jpeg";
  const dataUrl = `data:${mime};base64,${base64}`;

  const result = await runPipeline({
    imageData: buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength),
    imageBase64: dataUrl,
  });

  const predictedMl = result.fillRatio !== null ? Math.round(result.fillRatio * 1500) : null;
  const absErr = predictedMl !== null ? Math.abs(predictedMl - fx.ml) : null;
  const exactPass = absErr !== null && absErr <= 55;
  const categoryMatch = result.category === fx.cat;

  results.push({
    file: fx.path.split("/").pop() ?? fx.path,
    groundTruth: { ml: fx.ml, cat: fx.cat },
    predicted: { ml: predictedMl, cat: result.category },
    confidence: result.confidence,
    tier: result.tier,
    contourFound: result.diagnostics.contourFound,
    edgeStrength: result.diagnostics.edgeStrength,
    latencyMs: Date.now() - t0,
    stages: result.diagnostics.stages,
  });

  const status = exactPass ? "✓" : categoryMatch ? "~" : "✗";
  console.log(`${status} ${fx.path.split("/").pop()?.padEnd(30)} gt=${fx.ml}ml(${fx.cat}) pred=${predictedMl ?? "ERR"}ml(${result.category ?? "?"}) conf=${result.tier}(${result.confidence.toFixed(2)}) err=${absErr ?? "?"}ms=${Date.now() - t0}`);
}

const outPath = join(outDir, `ablation-${Date.now()}.json`);
await writeFile(outPath, JSON.stringify(results, null, 2));

const exactCount = results.filter(r => r.groundTruth.cat === r.predicted.cat).length;
console.log(`\nCategory accuracy: ${exactCount}/${results.length}`);
console.log(`Results: ${outPath}`);
