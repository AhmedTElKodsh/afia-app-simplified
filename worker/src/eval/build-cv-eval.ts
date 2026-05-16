#!/usr/bin/env tsx
import { readdir, writeFile, mkdir } from "node:fs/promises";
import { extname, join, resolve, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../../..");

function fillBucket(ml: number): string {
  if (ml === 0) return "empty-low";
  if (ml <= 330) return "empty-low";
  if (ml <= 660) return "mid-low";
  if (ml <= 990) return "mid-high";
  return "high";
}

async function listImages(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...await listImages(path));
    else if (/\.(jpe?g|png|webp)$/i.test(entry.name)) files.push(path);
  }
  return files;
}

function groundMlFromDir(path: string): number {
  const match = path.match(/[\\/](\d+ml|empty)[\\/]/i);
  if (!match) throw new Error(`Cannot infer ml from ${path}`);
  if (match[1].toLowerCase() === "empty") return 0;
  return Number.parseInt(match[1], 10);
}

// Use real frames only (no augmentations) for cleaner evaluation
const framesRoot = resolve(repoRoot, "oil-bottle-frames");
const allImages = await listImages(framesRoot);
const validImages = allImages.filter((p) => /[\\/](\d+ml|empty)[\\/]/i.test(p) && !p.includes("1.5L_refs") && !p.includes("Adobe Express"));

// Group by fill level
const byLevel = new Map<number, string[]>();
for (const img of validImages) {
  const ml = groundMlFromDir(img);
  if (!byLevel.has(ml)) byLevel.set(ml, []);
  byLevel.get(ml)!.push(img);
}

// Determine target per level: ~200 / 29 levels ≈ 7 each, weighted toward mid-range nonlinear zones
const TARGET_TOTAL = 200;
const levels = [...byLevel.entries()].sort((a, b) => a[0] - b[0]);

// Weight: more samples near nonlinear regions (shoulder ~165-330ml, base ~1210-1485ml)
function weight(ml: number): number {
  const emptyMid = ml <= 330 ? 1.5 : 1.0;
  const highMid = ml >= 1210 ? 1.5 : 1.0;
  const mid = ml >= 440 && ml <= 880 ? 0.7 : 1.0;
  return emptyMid * highMid * mid;
}

const totalWeight = levels.reduce((s, [ml]) => s + weight(ml), 0);
const selected: Array<{ imagePath: string; groundTruthMl: number; source: string; fillBucket: string; stratum: string }> = [];

for (const [ml, images] of levels) {
  const targetCount = Math.max(1, Math.round((TARGET_TOTAL * weight(ml)) / totalWeight));
  const shuffled = images.sort(() => Math.random() - 0.5);
  const picked = shuffled.slice(0, Math.min(targetCount, shuffled.length));

  for (const img of picked) {
    const relPath = relative(repoRoot, img).replace(/\\/g, "/");
    const fb = fillBucket(ml);
    selected.push({
      imagePath: relPath,
      groundTruthMl: ml,
      source: "real",
      fillBucket: fb,
      stratum: `real:${fb}:frame`,
    });
  }
}

// Sort by ml for readability
selected.sort((a, b) => a.groundTruthMl - b.groundTruthMl);

const manifest = {
  name: "cv-eval-200",
  why: "Stratified 200-image eval set for CV pipeline confidence calibration. Weights nonlinear measurement regions (shoulder, base) higher.",
  seed: Date.now(),
  fixtures: selected,
};

const outDir = resolve(repoRoot, "worker/test/fixtures/cv-eval");
await mkdir(outDir, { recursive: true });
await writeFile(join(outDir, "manifest.json"), JSON.stringify(manifest, null, 2));

console.log(`CV eval manifest: ${selected.length} images`);
console.log(`Levels covered: ${levels.length}`);

const byFill = new Map<string, number>();
for (const f of selected) {
  byFill.set(f.fillBucket, (byFill.get(f.fillBucket) ?? 0) + 1);
}
for (const [bucket, count] of [...byFill.entries()].sort()) {
  console.log(`  ${bucket}: ${count}`);
}
