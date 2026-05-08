#!/usr/bin/env tsx
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { loadEnv } from "../env.js";

import { analyzeFixture } from "../llm/analyze.js";
import { compareMl, COMPARATOR_NAME, COMPARATOR_VERSION } from "./compare.js";
import { writeRunRecord } from "./jsonl.js";
import type { RunRecord } from "@afia/shared";
import type { FixtureEntry } from "./manifest.js";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, "").split("=");
    return [k, v ?? "true"];
  })
);
const set = args.set === "holdout" ? "holdout" : "dev";
const manifestPath = resolve(repoRoot, `worker/test/fixtures/${set}/manifest.json`);
const manifest = JSON.parse(await readFile(manifestPath, "utf8"));

if (set === "holdout") {
  manifest.holdoutTouches = (manifest.holdoutTouches ?? 0) + 1;
  await writeFile(manifestPath, JSON.stringify(manifest, null, 2));
  console.warn(`[seal] holdout touched, count = ${manifest.holdoutTouches}`);
}

const env = loadEnv();
const runId = randomUUID();
const runStartedTs = new Date().toISOString();
const outDir = resolve(repoRoot, "runs");
await mkdir(outDir, { recursive: true });
const outPath = resolve(outDir, `${runStartedTs.replace(/[:.]/g, "-")}_${set}_${runId.slice(0, 8)}.jsonl`);

let n = 0, exact = 0, close = 0;
const perStratum = new Map<string, { n: number; exact: number }>();

for (const fx of manifest.fixtures as FixtureEntry[]) {
  n++;
  const { rawOutput, parsed, prompt } = await analyzeFixture(fx.imagePath, env);
  const comp = parsed ? compareMl(parsed.remainingMl, fx.groundTruthMl) : null;
  const rec: RunRecord = {
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
  };
  await writeRunRecord(outPath, rec);
  if (rec.exactBucketPass) exact++;
  if (rec.closeBucketPass) close++;
  const s = perStratum.get(fx.stratum) ?? { n: 0, exact: 0 };
  s.n++;
  if (rec.exactBucketPass) s.exact++;
  perStratum.set(fx.stratum, s);
  process.stdout.write(
    `[${n}/${manifest.fixtures.length}] ${fx.imageId} gt=${fx.groundTruthMl} pred=${rec.parsedMl ?? "ERR"} ${rec.exactBucketPass ? "✓" : "✗"}\n`
  );
}

console.log(`\n=== ${set} run ${runId} ===`);
console.log(`exact (±55ml): ${exact}/${n} = ${(100 * exact / n).toFixed(1)}%`);
console.log(`close (±110ml): ${close}/${n} = ${(100 * close / n).toFixed(1)}%`);
console.log(`\nper-stratum exact:`);
for (const [k, v] of [...perStratum.entries()].sort()) {
  console.log(`  ${k}: ${v.exact}/${v.n} = ${(100 * v.exact / v.n).toFixed(1)}%`);
}
console.log(`\noutput: ${outPath}`);
