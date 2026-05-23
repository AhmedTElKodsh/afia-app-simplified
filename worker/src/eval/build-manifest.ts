#!/usr/bin/env tsx
import { sampleManifest } from "./manifest.js";
import { writeFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");

const m = await sampleManifest({
  devCount: 60,
  holdoutCount: 40,
  seed: 20260507,
  framesRoot: resolve(repoRoot, "oil-bottle-frames/oil-bottle-frames"),
  augRoot: resolve(repoRoot, "oil-bottle-frames/oil-bottle-augmented"),
});

const devManifest = resolve(repoRoot, "worker/test/fixtures/dev");
const holdoutManifest = resolve(repoRoot, "worker/test/fixtures/holdout");
await mkdir(devManifest, { recursive: true });
await mkdir(holdoutManifest, { recursive: true });

await writeFile(
  resolve(devManifest, "manifest.json"),
  JSON.stringify({ seed: m.seed, cellCounts: m.cellCounts, fixtures: m.dev }, null, 2)
);
await writeFile(
  resolve(holdoutManifest, "manifest.json"),
  JSON.stringify({ seed: m.seed, cellCounts: m.cellCounts, fixtures: m.holdout, sealed: true, holdoutTouches: 0 }, null, 2)
);

console.log(`dev=${m.dev.length} holdout=${m.holdout.length}`);
console.log(`strata: ${Object.keys(m.cellCounts).length}`);
for (const [k, v] of Object.entries(m.cellCounts).sort()) {
  console.log(`  ${k}: ${v}`);
}
