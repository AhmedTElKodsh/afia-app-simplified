#!/usr/bin/env tsx
import { extname, join, resolve, dirname } from "node:path";
import { readFile, writeFile, mkdir, readdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { runPipeline } from "../cv/pipeline.js";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY ?? "";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../../..");

const manifestPathArg = process.argv.find(a => !a.startsWith("-") && (a.endsWith(".json")));
const manifestPath = manifestPathArg
  ? resolve(repoRoot, manifestPathArg)
  : resolve(repoRoot, "worker/test/fixtures/cv-eval/manifest.json");

const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
const fixtures = manifest.fixtures;

console.log("=== CV Pipeline Eval ===");
console.log(`Manifest: ${manifest.name ?? manifestPath}`);
console.log(`Testing ${fixtures.length} images\n`);

const results: Array<{
  imageId: string;
  groundTruthMl: number;
  cvMl: number | null;
  absErrorMl: number | null;
  exactBucketPass: boolean;
  closeBucketPass: boolean;
  tier: string;
  confidenceScore: number;
  fillRatio: number | null;
  contourFound: boolean;
  edgeStrength: number;
  stages: string[];
  missReason?: string;
  onnxScore?: number;
}> = [];

let exact = 0, close = 0, n = 0;
const latencies: number[] = [];
const dryRun = process.argv.includes("--dry-run");

let processedCount = 0;
for (const fx of fixtures) {
  if (dryRun && processedCount >= 1) break; 
  processedCount++;

  const t0 = Date.now();
  n = processedCount;
  const imgPath = resolve(repoRoot, fx.imagePath);
  const groundTruthMl = fx.groundTruthMl;
  const buf = await readFile(imgPath);
  const base64 = buf.toString("base64");
  const ext = extname(imgPath).toLowerCase();
  const mime = ext === ".png" ? "image/png" : ext === ".webp" ? "image/webp" : "image/jpeg";
  const dataUrl = `data:${mime};base64,${base64}`;

  const result = await runPipeline({
    imageData: buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength),
    imageBase64: dataUrl,
    geminiApiKey: GEMINI_API_KEY || undefined,
  });

  const cvMl = result.fillRatio !== null ? Math.round(result.fillRatio * 1500) : null;
  const absErr = cvMl !== null ? Math.abs(cvMl - groundTruthMl) : null;
  const exactPass = absErr !== null && absErr <= 55;
  const closePass = absErr !== null && absErr <= 110;

  if (exactPass) exact++;
  if (closePass) close++;

  results.push({
    imageId: fx.imageId ?? fx.imagePath,
    groundTruthMl,
    cvMl,
    absErrorMl: absErr,
    exactBucketPass: exactPass,
    closeBucketPass: closePass,
    tier: result.tier,
    confidenceScore: result.confidence,
    fillRatio: result.fillRatio,
    contourFound: result.diagnostics.contourFound,
    edgeStrength: result.diagnostics.edgeStrength,
    stages: result.diagnostics.stages,
    missReason: result.diagnostics.missReason,
    onnxScore: result.diagnostics.onnxScore,
  });

  console.log(`[${n}/${fixtures.length}] ${fx.imageId ?? fx.imagePath.split("/").pop()} gt=${groundTruthMl} cv=${cvMl ?? "ERR"} err=${absErr ?? "?"} conf=${result.tier} onnx=${result.diagnostics.onnxScore?.toFixed(2) ?? "N/A"} ${exactPass ? "✓" : "✗"}`);

  const elapsed = Date.now() - t0;
  latencies.push(elapsed);

  // Rate limiting for pipeline
  if (n < fixtures.length) {
    await new Promise((r) => setTimeout(r, 500));
  }
}

// Write results
const outDir = resolve(repoRoot, "runs/cv-eval-200");
await mkdir(outDir, { recursive: true });
const outPath = join(outDir, `cv-eval-${Date.now()}.json`);
await writeFile(outPath, JSON.stringify(results, null, 2));

// Summary
console.log(`\n=== CV Pipeline Results (${fixtures.length} images) ===`);
console.log(`exact (±55ml): ${exact}/${n} = ${(100 * exact / n).toFixed(1)}%`);
console.log(`close (±110ml): ${close}/${n} = ${(100 * close / n).toFixed(1)}%`);
const contourFoundCount = results.filter(r => r.contourFound).length;
console.log(`contour found: ${contourFoundCount}/${n} = ${(100 * contourFoundCount / n).toFixed(1)}%`);

// Latency
if (latencies.length > 0) {
  const sorted = [...latencies].sort((a, b) => a - b);
  const avg = latencies.reduce((s, v) => s + v, 0) / latencies.length;
  const p50 = sorted[Math.floor(sorted.length * 0.5)];
  const p95 = sorted[Math.floor(sorted.length * 0.95)];
  const p99 = sorted[Math.floor(sorted.length * 0.99)];
  console.log(`\nLatency (ms): avg=${avg.toFixed(0)} p50=${p50} p95=${p95} p99=${p99}`);
}

// Per confidence tier
const tiers = new Map<string, { n: number; exact: number }>();
for (const r of results) {
  const t = r.tier;
  if (!tiers.has(t)) tiers.set(t, { n: 0, exact: 0 });
  const entry = tiers.get(t)!;
  entry.n++;
  if (r.exactBucketPass) entry.exact++;
}

console.log(`\nPer confidence tier:`);
for (const [tier, data] of [...tiers.entries()].sort()) {
  console.log(`  ${tier}: ${data.exact}/${data.n} = ${(100 * data.exact / data.n).toFixed(1)}% exact`);
}

// Per fill bucket (stratum)
const buckets = new Map<string, { n: number; exact: number; close: number }>();
for (const r of results) {
  const b = bucketForMl(r.groundTruthMl);
  if (!buckets.has(b)) buckets.set(b, { n: 0, exact: 0, close: 0 });
  const e = buckets.get(b)!;
  e.n++;
  if (r.exactBucketPass) e.exact++;
  if (r.closeBucketPass) e.close++;
}

console.log(`\nPer fill bucket:`);
for (const [bucket, data] of [...buckets.entries()].sort()) {
  console.log(`  ${bucket}: exact ${data.exact}/${data.n} (${(100 * data.exact / data.n).toFixed(1)}%) close ${data.close}/${data.n} (${(100 * data.close / data.n).toFixed(1)}%)`);
}

// MAE per tier
const maeByTier = new Map<string, number[]>();
for (const r of results) {
  if (r.absErrorMl === null) continue;
  if (!maeByTier.has(r.tier)) maeByTier.set(r.tier, []);
  maeByTier.get(r.tier)!.push(r.absErrorMl);
}
console.log(`\nMAE per tier:`);
for (const [tier, errors] of [...maeByTier.entries()].sort()) {
  const avg = errors.reduce((s, e) => s + e, 0) / errors.length;
  console.log(`  ${tier}: ${avg.toFixed(1)}ml (${errors.length} samples)`);
}

// Confusion bands: what does the model predict when it's wrong?
const confusion = new Map<string, number>();
for (const r of results) {
  if (r.absErrorMl === null) continue;
  const actual = bandForMl(r.groundTruthMl);
  const predicted = r.cvMl !== null ? bandForMl(r.cvMl) : "ERR";
  const key = `${actual}→${predicted}`;
  confusion.set(key, (confusion.get(key) ?? 0) + 1);
}
console.log(`\nConfusion bands:`);
for (const [k, v] of [...confusion.entries()].sort()) {
  console.log(`  ${k}: ${v}`);
}

// 95% confidence interval for exact accuracy (Wilson score)
if (n > 0) {
  const z = 1.96;
  const p = exact / n;
  const denominator = 1 + z * z / n;
  const center = (p + z * z / (2 * n)) / denominator;
  const margin = z * Math.sqrt((p * (1 - p) + z * z / (4 * n)) / n) / denominator;
  const ciLo = Math.max(0, center - margin);
  const ciHi = Math.min(1, center + margin);
  console.log(`\n95% CI for exact accuracy: [${(100 * ciLo).toFixed(1)}%, ${(100 * ciHi).toFixed(1)}%]`);
}

// Miss reason distribution
const missCounts = new Map<string, number>();
for (const r of results) {
  if (r.missReason) {
    missCounts.set(r.missReason, (missCounts.get(r.missReason) ?? 0) + 1);
  }
}
if (missCounts.size > 0) {
  const totalMisses = [...missCounts.values()].reduce((s, c) => s + c, 0);
  console.log(`\nMiss reasons (${totalMisses} total):`);
  for (const [reason, count] of [...missCounts.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${reason}: ${count} (${(100 * count / totalMisses).toFixed(1)}%)`);
  }
}

// Worst misses
const worst = results.filter((r) => r.absErrorMl !== null).sort((a, b) => (b.absErrorMl ?? 0) - (a.absErrorMl ?? 0)).slice(0, 5);
console.log(`\nWorst misses:`);
for (const w of worst) {
  console.log(`  ${w.imageId} gt=${w.groundTruthMl} cv=${w.cvMl} err=${w.absErrorMl} conf=${w.tier}(${w.confidenceScore.toFixed(2)}) onnx=${w.onnxScore?.toFixed(2) ?? "N/A"}`);
}

// ONNX vs CV Delta analysis
const onnxDeltas = results.filter(r => r.onnxScore !== undefined && r.fillRatio !== null)
  .map(r => Math.abs((r.onnxScore! * 1500) - (r.fillRatio! * 1500)));
if (onnxDeltas.length > 0) {
  const avgDelta = onnxDeltas.reduce((s, d) => s + d, 0) / onnxDeltas.length;
  console.log(`\nONNX vs CV Pipeline Delta:`);
  console.log(`  Avg Delta: ${avgDelta.toFixed(1)}ml`);
}

function bucketForMl(ml: number): string {
  if (ml === 0) return "empty";
  if (ml <= 165) return "very_low(0-165)";
  if (ml <= 330) return "low(165-330)";
  if (ml <= 660) return "mid_low(330-660)";
  if (ml <= 990) return "mid_high(660-990)";
  if (ml <= 1320) return "high(990-1320)";
  return "very_high(1320-1500)";
}

function bandForMl(ml: number): string {
  if (ml === 0) return "empty";
  if (ml <= 330) return "low";
  if (ml <= 990) return "mid";
  return "high";
}

console.log(`\nResults written: ${outPath}`);

// Regression check: compare against a previous run if BASELINE_RUN env var is set
const baselinePath = process.env.BASELINE_RUN;
if (baselinePath) {
  try {
    const baseline = JSON.parse(await readFile(baselinePath, "utf8")) as typeof results;
    const baselineExact = baseline.filter((r: any) => r.exactBucketPass).length;
    const baselineClose = baseline.filter((r: any) => r.closeBucketPass).length;
    const baselinePct = (100 * baselineExact / baseline.length).toFixed(1);
    const delta = exact - baselineExact;
    const deltaPct = ((exact / n) - (baselineExact / baseline.length)) * 100;
    console.log(`\n=== Regression Check (vs ${baselinePath}) ===`);
    console.log(`  Baseline: ${baselineExact}/${baseline.length} = ${baselinePct}% exact`);
    console.log(`  Current:  ${exact}/${n} = ${(100 * exact / n).toFixed(1)}% exact`);
    console.log(`  Delta:    ${delta > 0 ? "+" : ""}${deltaPct.toFixed(1)}pp`);

    const regressionThreshold = Number(process.env.REGRESSION_THRESHOLD_PCT) || 2.0;
    if (deltaPct < -regressionThreshold) {
      console.error(`\n❌ REGRESSION DETECTED: Exact accuracy dropped by ${Math.abs(deltaPct).toFixed(1)}pp (threshold: ${regressionThreshold}pp)`);
      process.exit(1);
    } else {
      console.log(`\n✅ No regression (threshold: ${regressionThreshold}pp)`);
    }
  } catch (e) {
    console.error(`\n⚠ Could not read baseline: ${(e as Error).message}`);
  }
}
