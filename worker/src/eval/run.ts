#!/usr/bin/env tsx
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { basename, dirname, resolve } from "node:path";
import { loadEnv } from "../env.js";

import { analyzeFixture } from "../llm/analyze.js";
import { compareMl, COMPARATOR_NAME, COMPARATOR_VERSION } from "./compare.js";
import { writeRunRecord } from "./jsonl.js";
import type { RunRecord } from "@afia/shared";
import type { FixtureEntry } from "./manifest.js";

type DiagnosticFixture = FixtureEntry & {
  source?: string;
  fillBucket?: string;
  frameBucket?: string;
  reason?: string;
};

type DiagnosticRecord = RunRecord & {
  source?: string;
  fillBucket?: string;
  frameBucket?: string;
  reason?: string;
};

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, "").split("=");
    return [k, v ?? "true"];
  })
);
const set = args.set === "holdout" ? "holdout" : "dev";
const manifestPath = args.manifest
  ? resolve(repoRoot, args.manifest)
  : resolve(repoRoot, `worker/test/fixtures/${set}/manifest.json`);
const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
const runLabel = args.label ?? manifest.name ?? (args.manifest ? basename(dirname(manifestPath)).replace(/[^a-z0-9_-]/gi, "-") : set);

if (set === "holdout" && !args.manifest) {
  manifest.holdoutTouches = (manifest.holdoutTouches ?? 0) + 1;
  await writeFile(manifestPath, JSON.stringify(manifest, null, 2));
  console.warn(`[seal] holdout touched, count = ${manifest.holdoutTouches}`);
}

const env = loadEnv();
const runId = randomUUID();
const runStartedTs = new Date().toISOString();
const outDir = resolve(repoRoot, "runs");
await mkdir(outDir, { recursive: true });
const outPath = resolve(outDir, `${runStartedTs.replace(/[:.]/g, "-")}_${runLabel}_${runId.slice(0, 8)}.jsonl`);

let n = 0, exact = 0, close = 0;
const perStratum = new Map<string, { n: number; exact: number }>();
const perSource = new Map<string, { n: number; exact: number }>();
const perFillBucket = new Map<string, { n: number; exact: number }>();
const records: DiagnosticRecord[] = [];

for (const fx of manifest.fixtures as DiagnosticFixture[]) {
  n++;
  const { rawOutput, parsed, prompt } = await analyzeFixture(fx.imagePath, env);
  const comp = parsed ? compareMl(parsed.remainingMl, fx.groundTruthMl) : null;
  const rec: DiagnosticRecord = {
    runId, runStartedTs,
    promptHash: prompt.promptHash, fewshotHash: prompt.fewshotHash,
    modelId: env.MODEL_ID, modelVersion: prompt.promptVersion,
    imageId: fx.imageId, imagePath: fx.imagePath, stratum: fx.stratum,
    groundTruthMl: fx.groundTruthMl,
    rawOutput,
    parsedMl: parsed?.remainingMl ?? null,
    parsedConfidence: parsed?.confidence ?? null,
    absErrorMl: comp?.absErrorMl ?? null,
    exactBucketPass: comp?.exactBucketPass ?? false,
    closeBucketPass: comp?.closeBucketPass ?? false,
    comparatorName: COMPARATOR_NAME, comparatorVersion: COMPARATOR_VERSION,
    holdoutTouches: set === "holdout" ? manifest.holdoutTouches : 0,
    source: fx.source,
    fillBucket: fx.fillBucket,
    frameBucket: fx.frameBucket,
    reason: fx.reason,
  };
  records.push(rec);
  await writeRunRecord(outPath, rec);
  if (rec.exactBucketPass) exact++;
  if (rec.closeBucketPass) close++;
  bump(perStratum, fx.stratum, rec.exactBucketPass);
  if (fx.source) bump(perSource, fx.source, rec.exactBucketPass);
  if (fx.fillBucket) bump(perFillBucket, fx.fillBucket, rec.exactBucketPass);
  process.stdout.write(
    `[${n}/${manifest.fixtures.length}] ${fx.imageId} gt=${fx.groundTruthMl} pred=${rec.parsedMl ?? "ERR"} ${rec.exactBucketPass ? "✓" : "✗"}\n`
  );

  // Rate limiting for Gemini free tier (5 requests per minute -> ~1 request every 13s)
  if (n < manifest.fixtures.length) {
    await new Promise((r) => setTimeout(r, 13000));
  }
}

console.log(`\n=== ${set} run ${runId} ===`);
console.log(`exact (±55ml): ${exact}/${n} = ${(100 * exact / n).toFixed(1)}%`);
console.log(`close (±110ml): ${close}/${n} = ${(100 * close / n).toFixed(1)}%`);
console.log(`\nper-stratum exact:`);
for (const [k, v] of [...perStratum.entries()].sort()) {
  console.log(`  ${k}: ${v.exact}/${v.n} = ${(100 * v.exact / v.n).toFixed(1)}%`);
}
if (perSource.size > 0) {
  console.log(`\nper-source exact:`);
  for (const [k, v] of [...perSource.entries()].sort()) {
    console.log(`  ${k}: ${v.exact}/${v.n} = ${(100 * v.exact / v.n).toFixed(1)}%`);
  }
}
if (perFillBucket.size > 0) {
  console.log(`\nper-fill-bucket exact:`);
  for (const [k, v] of [...perFillBucket.entries()].sort()) {
    console.log(`  ${k}: ${v.exact}/${v.n} = ${(100 * v.exact / v.n).toFixed(1)}%`);
  }
}

const confidenceRows = records.filter((r) => typeof r.parsedConfidence === "number" && typeof r.absErrorMl === "number");
if (confidenceRows.length > 0) {
  const avgConfidence = confidenceRows.reduce((sum, r) => sum + (r.parsedConfidence ?? 0), 0) / confidenceRows.length;
  const avgError = confidenceRows.reduce((sum, r) => sum + (r.absErrorMl ?? 0), 0) / confidenceRows.length;
  const highConfMisses = confidenceRows.filter((r) => (r.parsedConfidence ?? 0) >= 0.8 && !(r.exactBucketPass));
  console.log(`\navg confidence: ${avgConfidence.toFixed(2)}`);
  console.log(`avg abs error: ${avgError.toFixed(1)}ml`);
  console.log(`high-confidence misses (>=0.80 confidence, not exact): ${highConfMisses.length}`);
}

const confusionBands = new Map<string, number>();
for (const r of records) {
  if (r.parsedMl === null) continue;
  const key = `${bandForMl(r.groundTruthMl)}→${bandForMl(r.parsedMl)}`;
  confusionBands.set(key, (confusionBands.get(key) ?? 0) + 1);
}
if (confusionBands.size > 0) {
  console.log(`\nconfusion bands:`);
  for (const [k, v] of [...confusionBands.entries()].sort()) {
    console.log(`  ${k}: ${v}`);
  }
}

const worstMisses = records
  .filter((r) => typeof r.absErrorMl === "number")
  .sort((a, b) => (b.absErrorMl ?? -1) - (a.absErrorMl ?? -1))
  .slice(0, Math.min(5, records.length));
if (worstMisses.length > 0) {
  console.log(`\nworst misses:`);
  for (const miss of worstMisses) {
    const rawExcerpt = miss.rawOutput.replace(/\s+/g, " ").slice(0, 160);
    console.log(`  ${miss.imageId}`);
    console.log(`    gt=${miss.groundTruthMl} pred=${miss.parsedMl ?? "ERR"} err=${miss.absErrorMl ?? "ERR"} conf=${miss.parsedConfidence ?? "ERR"} stratum=${miss.stratum}`);
    if (miss.reason) console.log(`    probe-note=${miss.reason}`);
    console.log(`    raw=${rawExcerpt}`);
  }
}
console.log(`\noutput: ${outPath}`);

function bump(map: Map<string, { n: number; exact: number }>, key: string, exactPass: boolean) {
  const current = map.get(key) ?? { n: 0, exact: 0 };
  current.n += 1;
  if (exactPass) current.exact += 1;
  map.set(key, current);
}

function bandForMl(ml: number): "low" | "mid" | "high" {
  if (ml <= 330) return "low";
  if (ml <= 990) return "mid";
  return "high";
}
