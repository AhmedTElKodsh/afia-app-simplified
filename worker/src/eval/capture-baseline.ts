#!/usr/bin/env tsx
// Captures heuristic pipeline MAE/RMSE baseline for Phase 3 comparison
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const manifestPath = resolve(repoRoot, "worker/test/fixtures/dev/manifest.json");

const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
console.log(`Capturing baseline from ${manifest.fixtures.length} fixtures...`);

// Run eval using the existing runner
const { analyzeFixture } = await import("../llm/analyze.js");
const { loadEnv } = await import("../env.js");
const env = loadEnv();

const errors: number[] = [];
for (const fx of manifest.fixtures) {
  const { parsed } = await analyzeFixture(fx.imagePath, env);
  if (parsed?.remainingMl != null) {
    const err = Math.abs(parsed.remainingMl - fx.groundTruthMl);
    errors.push(err);
  }
}

const mae = errors.length > 0 ? errors.reduce((s, e) => s + e, 0) / errors.length : 0;
const rmse = Math.sqrt(errors.reduce((s, e) => s + e * e, 0) / errors.length);
console.log(`\n=== Heuristic Baseline ===`);
console.log(`Fixtures: ${errors.length}`);
console.log(`MAE: ${mae.toFixed(1)}ml`);
console.log(`RMSE: ${rmse.toFixed(1)}ml`);

const outDir = resolve(repoRoot, "runs/baseline");
await mkdir(outDir, { recursive: true });
const outPath = resolve(outDir, `heuristic-baseline-${Date.now()}.json`);
await writeFile(outPath, JSON.stringify({
  date: new Date().toISOString(),
  label: "heuristic-baseline",
  pipeline: "heuristic (CLAHE 3.0, contour scoring)",
  fixtureSet: "dev",
  fixtureCount: errors.length,
  mae: Math.round(mae * 10) / 10,
  rmse: Math.round(rmse * 10) / 10,
}, null, 2));
console.log(`Baseline written: ${outPath}`);
