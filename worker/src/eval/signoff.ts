#!/usr/bin/env tsx
import { readFile, appendFile } from "node:fs/promises";
import { readdirSync } from "node:fs";
import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const runsDir = resolve(repoRoot, "runs");

const HOLDOUT_RUNS_NEEDED = 3;
const AGGREGATE_BAR = 0.90;
const STRATUM_BAR = 0.80;
const BYTE_STABLE_MIN = 38;

const files = readdirSync(runsDir)
  .filter((f) => f.includes("_holdout_") && f.endsWith(".jsonl"))
  .sort()
  .slice(-HOLDOUT_RUNS_NEEDED);

if (files.length < HOLDOUT_RUNS_NEEDED) {
  console.error(`Need ${HOLDOUT_RUNS_NEEDED} holdout runs, found ${files.length}.`);
  console.error("Run: pnpm eval:holdout (three times)");
  process.exit(2);
}

interface Row { imageId: string; stratum: string; rawOutput: string; exactBucketPass: boolean; }
const runs: Row[][] = [];
for (const f of files) {
  const lines = (await readFile(resolve(runsDir, f), "utf8")).trim().split("\n");
  runs.push(lines.map((l) => JSON.parse(l)));
}

const latest = runs[runs.length - 1];
const totalExact = latest.filter((r) => r.exactBucketPass).length;
const aggregate = totalExact / latest.length;
console.log(`\n=== Stage 1 Exit Gate ===`);
console.log(`aggregate exact (±55ml): ${totalExact}/${latest.length} = ${(100 * aggregate).toFixed(1)}% (bar: 90%)`);

const byStratum = new Map<string, { n: number; exact: number }>();
for (const r of latest) {
  const s = byStratum.get(r.stratum) ?? { n: 0, exact: 0 };
  s.n++; if (r.exactBucketPass) s.exact++;
  byStratum.set(r.stratum, s);
}
let stratumPass = true;
console.log(`\nper-stratum (bar: 80%):`);
for (const [k, v] of [...byStratum.entries()].sort()) {
  const acc = v.exact / v.n;
  const ok = acc >= STRATUM_BAR;
  console.log(`  ${k}: ${v.exact}/${v.n} = ${(100 * acc).toFixed(1)}% ${ok ? "✓" : "✗"}`);
  if (!ok) stratumPass = false;
}

let byteStable = 0;
for (let i = 0; i < latest.length; i++) {
  const outputs = runs.map((r) => r[i]?.rawOutput);
  if (outputs.every((o) => o === outputs[0])) byteStable++;
}
console.log(`\nbyte-stable across ${HOLDOUT_RUNS_NEEDED} runs: ${byteStable}/${latest.length} (bar: ${BYTE_STABLE_MIN})`);

const metricsPass = aggregate >= AGGREGATE_BAR && stratumPass && byteStable >= BYTE_STABLE_MIN;
console.log(`\nMETRIC GATE: ${metricsPass ? "PASS ✓" : "FAIL ✗"}`);

if (!metricsPass) {
  console.log("\nIterate prompt/few-shots on dev set (pnpm eval:dev).");
  console.log("Do NOT touch holdout fixtures during iteration.");
  process.exit(1);
}

const rl = createInterface({ input, output });
console.log("\n--- REVIEWER SIGN-OFF ---");
console.log("Review the latest holdout JSONL before signing off.");
console.log(`File: runs/${files[files.length - 1]}\n`);
const reviewer = await rl.question("Reviewer name: ");
const decision = (await rl.question("Trustworthy enough to fund Stage 2? (yes/no): ")).trim().toLowerCase();
const notes = await rl.question("Notes (press Enter to skip): ");
rl.close();

await appendFile(resolve(runsDir, "signoffs.jsonl"), JSON.stringify({
  ts: new Date().toISOString(),
  reviewer,
  decision,
  notes,
  runFiles: files,
  aggregate: parseFloat((100 * aggregate).toFixed(1)),
  byteStable,
  perStratum: Object.fromEntries([...byStratum.entries()].map(([k, v]) => [k, { n: v.n, exact: v.exact }])),
}) + "\n");

if (decision !== "yes") {
  console.log("\nSign-off recorded as no-go. Stage 1 not complete.");
  process.exit(1);
}
console.log("\nStage 1 PASS. Tag with: git tag stage1/passed && git push --tags");
